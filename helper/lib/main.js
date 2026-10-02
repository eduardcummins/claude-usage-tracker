import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newTopic, readConfig, requireConfig, writeConfig } from './config.js';
import { defaultNtfyServer } from './server.js';
import { ensureFreshCredentials, loadCredentials } from './credentials.js';
import { UserError } from './errors.js';
import { installMac, uninstallMac } from './install.js';
import { dataTopic, publishNtfy } from './ntfy.js';
import { encodePairing } from './pairing.js';
import { writeTopicPage } from './qr.js';
import { newKey, sealJson } from './seal.js';
import { fetchUsageResponse } from './oauth.js';
import { formatPlan, parseUsageResponse } from './parse-usage.js';
import { appPaths } from './paths.js';
import { redact } from './redact.js';
import { alertCopy, detectResetWindows, previousWindows, unseenResets } from './resets.js';
import { buildSnapshot, fitSnapshot, waitingSnapshot } from './snapshot.js';
import { loadState, saveState } from './state.js';
import { describeWindow, expiryMs, tokenStillValid } from './time.js';

const NOT_LOGGED_IN = `Claude Code is not logged in on this computer.

On a Mac, this helper reads the login from the macOS Keychain, which is where Claude Code stores it.
On Windows and Linux, it reads .credentials.json inside the Claude config folder (usually ~/.claude, or %USERPROFILE%\\.claude).

Open Claude Code in VS Code, sign in with your paid Claude subscription, send one message, then run this command again.`;

export const HELP = `Claude usage alert helper

Checks the Claude usage limits on this computer and sends them to your phone.
When a 5-hour or weekly limit resets, it sends an alert.

  node helper/cli.js --doctor
      Read your real Claude usage and print it. Nothing is sent to the phone.

  node helper/cli.js --init
      Create a private ntfy topic and save it on this computer.

  node helper/cli.js --test-alert
      Send a test phone notification.

  node helper/cli.js
      Check once: read usage, update the phone, alert if a limit reset.

  node helper/cli.js --watch
      Keep checking every 10 minutes in this window.

  node helper/cli.js install-mac
      macOS: check every 10 minutes in the background (launchd).

  node helper/cli.js uninstall-mac
      macOS: stop the background check.

  node helper/cli.js --mock --dry-run
      Show sample usage without a Claude login and without sending anything.

  node helper/cli.js --mock --scenario before
  node helper/cli.js --mock --scenario after
      Publish sample usage, then a sample reset. Use this to test the phone.

Windows background setup:  powershell -ExecutionPolicy Bypass -File helper\\install-windows.ps1
Linux background setup:    bash helper/install-linux.sh
`;

export function parseArgs(argv) {
  const args = {
    help: false,
    init: false,
    rotate: false,
    doctor: false,
    dryRun: false,
    mock: false,
    scenario: 'before',
    testAlert: false,
    watch: false,
    intervalMinutes: 10,
    command: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--init') args.init = true;
    else if (token === '--rotate') args.rotate = true;
    else if (token === '--doctor') args.doctor = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--mock') args.mock = true;
    else if (token === '--test-alert') args.testAlert = true;
    else if (token === '--watch') args.watch = true;
    else if (token === '--scenario') args.scenario = requiredValue(argv, ++i, '--scenario');
    else if (token === '--interval-minutes') {
      args.intervalMinutes = Number(requiredValue(argv, ++i, '--interval-minutes'));
    } else if (token === 'install-mac' || token === 'uninstall-mac') args.command = token;
    else throw new UserError(`Unknown argument: ${token}\n\n${HELP}`);
  }
  if (!/^[a-z0-9-]+$/.test(args.scenario)) {
    throw new UserError('Scenario names can only use lowercase letters, numbers, and hyphens.');
  }
  return args;
}

export async function main(argv, deps = {}) {
  const args = parseArgs(argv);
  const d = withDefaults(deps);
  if (args.help) {
    d.log(HELP.trimEnd());
    return 0;
  }
  if (args.command === 'install-mac') return installMac(d);
  if (args.command === 'uninstall-mac') return uninstallMac(d);
  if (args.init) return initConfig(d, args);
  if (args.testAlert) return sendTestAlert(d);
  if (args.doctor) return doctor(d);
  if (args.watch) return watch(d, args);
  return runCheck(d, args);
}

async function initConfig(deps, args) {
  const existing = await readConfig(deps.homeDir);
  if (existing && !args.rotate) {
    await printTopic(deps, existing);
    deps.log('Left the existing topic in place. To make a new one, run: node helper/cli.js --init --rotate');
    return 0;
  }
  const config = {
    ntfyServer: defaultNtfyServer(deps.env),
    ntfyTopic: newTopic(),
    ntfyKey: newKey(),
    timeZone: existing?.timeZone || 'Europe/London',
  };
  const file = await writeConfig(deps.homeDir, config);
  deps.log(`Saved ${file}`);
  await printTopic(deps, config);
  return 0;
}

async function printTopic(deps, config) {
  const pairing = config.ntfyKey
    ? encodePairing({ url: config.ntfyServer, topic: config.ntfyTopic, key: config.ntfyKey })
    : '';
  const code = pairing || config.ntfyTopic;
  const page = await writeTopicPage(deps.homeDir, code, pairing ? config.ntfyTopic : '');
  deps.log('');
  if (pairing) {
    deps.log('Pairing code:');
    deps.log(pairing);
    deps.log('');
  }
  deps.log(`Phone topic: ${config.ntfyTopic}`);
  deps.log(`Usage updates are published to ${config.ntfyServer}/${dataTopic(config.ntfyTopic)}`);
  deps.log('');
  deps.log(page.terminal);
  deps.log('');
  deps.log('On the phone, open Cluse and scan the code above, or paste the pairing code.');
  deps.log('A plain cu- topic with no key still works until you pair.');
  deps.log(`A larger code is saved at ${page.file}`);
  deps.log('The ntfy app is not required. Reset alerts are scheduled on the phone.');
  if (pairing) {
    deps.log('The pairing code is the only copy of the encryption key. ntfy stores ciphertext.');
  } else {
    deps.log('Treat the topic like a password. Anyone who knows it can see usage percentages.');
  }
}

async function sendTestAlert(deps) {
  const config = await requireConfig(deps.homeDir);
  if (!config.ntfyKey) {
    deps.log('This topic has no encryption key, so no test message was sent. Reset alerts are scheduled on the phone.');
    return 0;
  }
  await publishNtfy({
    server: config.ntfyServer,
    topic: dataTopic(config.ntfyTopic),
    title: 'Cluse',
    message: JSON.stringify(sealJson(config.ntfyKey, { v: 1, type: 'test' })),
    priority: 1,
    tags: ['test'],
    token: config.ntfyToken,
    fetch: deps.fetch,
  });
  deps.log('Sent an encrypted test message. Reset alerts are scheduled on the phone.');
  return 0;
}

async function watch(deps, args) {
  const minutes = intervalMinutes(args);
  deps.log(`Checking every ${minutes} minutes. Leave this window open. For a background check, use install-mac or the Windows script.`);
  for (;;) {
    try {
      await runCheck(deps, args);
    } catch (err) {
      deps.error(redact(err instanceof Error ? err.message : err));
    }
    await deps.sleep(minutes * 60 * 1000);
  }
}

export async function runCheck(deps, args) {
  return withRunLock(deps, async () => {
    const now = currentTime(deps);
    const mode = args.mock ? 'mock' : 'live';
    const state = await loadState(appPaths(deps.homeDir).state);
    if (!args.mock && state.backoffUntil && Date.parse(state.backoffUntil) > now) {
      const loaded = await loadCredentials(deps);
      const changed = loaded
        && state.backoffAccessFingerprint
        && tokenFingerprint(loaded.accessToken) !== state.backoffAccessFingerprint;
      if (!changed) {
        deps.log(`Skipping this check. The usage endpoint asked us to wait until ${state.backoffUntil}.`);
        return 0;
      }
    }

    const usage = args.mock ? await loadFixture(args.scenario) : await loadLiveUsage(deps);
    if (usage.kind === 'login-wait') {
      if (args.dryRun) {
        deps.log('Waiting for Claude Code login. Dry run: nothing was sent.');
        return 0;
      }
      return publishLoginWait(deps, state, now, usage.until);
    }
    if (usage.kind === 'rate-limited') {
      const until = new Date(now + usage.retryAfterSec * 1000).toISOString();
      await storeState(deps, {
        backoffUntil: until,
        backoffAccessFingerprint: usage.accessFingerprint || null,
      });
      deps.log(`Anthropic asked us to slow down. Next try after ${until}. Your last numbers are unchanged.`);
      return 0;
    }

    let parsed;
    try {
      parsed = parseUsageResponse(usage.body);
    } catch (err) {
      throw new UserError(err instanceof Error ? err.message : String(err));
    }
    if (parsed.windows.length === 0) {
      throw new UserError(
        'The usage response did not include any usage limits. This usually means the account is not signed in with a paid Claude subscription.',
      );
    }

    const config = args.dryRun ? await readConfig(deps.homeDir) : await requireConfig(deps.homeDir);
    const timeZone = config?.timeZone || 'Europe/London';
    const plan = args.mock ? 'Sample' : formatPlan(usage.subscriptionType, usage.rateLimitTier);
    const { snapshot, point } = buildSnapshot({
      fetchedAt: new Date(now).toISOString(),
      plan,
      timeZone,
      parsed,
      history: state.history,
    });
    const previous = previousWindows(state, mode);
    const alerts = unseenResets(detectResetWindows(previous, snapshot.windows), state.notifiedResets);
    const alert = alerts.length > 0 ? alertCopy(alerts, timeZone) : null;

    deps.log(snapshot.windows.map((window) => describeWindow(window, now, timeZone)).join('\n'));
    if (snapshot.extraUsageLabel) deps.log(snapshot.extraUsageLabel);
    if (alert) deps.log(`Alert: ${alert.title}`);

    if (args.dryRun) {
      deps.log('Dry run: nothing was sent and nothing was saved.');
      return 0;
    }

    const fitted = fitSnapshot(snapshot);
    const encrypted = Boolean(config.ntfyKey);
    await publishNtfy({
      server: config.ntfyServer,
      topic: dataTopic(config.ntfyTopic),
      title: encrypted ? 'Cluse' : fitted.windows.map((window) => `${window.shortLabel} ${window.usedPercent}%`).join(' · '),
      message: encrypted ? JSON.stringify(sealJson(config.ntfyKey, fitted)) : JSON.stringify(fitted),
      priority: 1,
      tags: ['snapshot'],
      token: config.ntfyToken,
      fetch: deps.fetch,
    });

    const notified = { ...state.notifiedResets };
    for (const window of alerts) notified[window.id] = window.resetsAt;
    await storeState(deps, {
      mode,
      lastSnapshot: {
        fetchedAt: snapshot.fetchedAt,
        plan: snapshot.plan,
        windows: snapshot.windows,
        extraUsageLabel: snapshot.extraUsageLabel,
      },
      history: [...state.history, point].slice(-200),
      notifiedResets: notified,
      backoffUntil: null,
      backoffAccessFingerprint: null,
      tokenBackoffUntil: null,
      tokenBackoffAttempt: 0,
    });
    deps.log('Sent the usage update.');
    return 0;
  });
}

async function doctor(deps) {
  return withRunLock(deps, async () => {
    const loaded = await loadCredentials(deps);
    if (!loaded) throw new UserError(NOT_LOGGED_IN);
    const { creds, result } = await authorizedUsage(loaded, deps);
    if (result.kind === 'login-wait') {
      const when = result.until ? ` The next refresh attempt is after ${result.until}.` : '';
      deps.log(`Waiting for Claude Code login. Open Claude Code on this computer to refresh.${when}`);
      deps.log('Nothing was sent to your phone.');
      return 0;
    }
    if (result.kind === 'rate-limited') {
      deps.log('The usage endpoint asked us to slow down. Try again in a little while.');
      return 0;
    }
    const parsed = parseUsageResponse(result.body);
    const now = currentTime(deps);
    const where = creds.source === 'keychain' ? 'the macOS Keychain' : creds.filePath;
    deps.log(`Login: found in ${where}.`);
    if (parsed.windows.length === 0) deps.log('No usage limits were returned.');
    else deps.log(parsed.windows.map((window) => describeWindow(window, now, 'Europe/London')).join('\n'));
    if (parsed.extraUsage) {
      deps.log(`Extra usage: $${parsed.extraUsage.usedUsd.toFixed(2)} of $${parsed.extraUsage.limitUsd.toFixed(2)}`);
    }
    deps.log('Nothing was sent to your phone.');
    return 0;
  });
}

async function loadLiveUsage(deps) {
  const loaded = await loadCredentials(deps);
  if (!loaded) throw new UserError(NOT_LOGGED_IN);
  const { creds, result } = await authorizedUsage(loaded, deps);
  if (result.kind === 'login-wait') return result;
  if (result.kind === 'rate-limited') {
    return { ...result, accessFingerprint: tokenFingerprint(creds.accessToken) };
  }
  return {
    kind: 'ok',
    body: result.body,
    subscriptionType: creds.subscriptionType,
    rateLimitTier: creds.rateLimitTier,
  };
}

async function authorizedUsage(loaded, deps) {
  try {
    let creds = await ensureFreshCredentials(loaded, deps);
    if (!usableAccess(creds, deps)) return { creds, result: { kind: 'login-wait', until: null } };
    let result = await requestUsage(creds, deps);
    if (result.kind === 'unauthorized') {
      creds = await ensureFreshCredentials(creds, deps, { force: true });
      if (!usableAccess(creds, deps)) return { creds, result: { kind: 'login-wait', until: null } };
      result = await requestUsage(creds, deps);
    }
    if (result.kind === 'unauthorized') {
      throw new UserError('Claude rejected the login. Open Claude Code and sign in again, then rerun this helper.');
    }
    return { creds, result };
  } catch (err) {
    if (err && err.code === 'refresh_deferred') {
      return { creds: loaded, result: { kind: 'login-wait', until: err.until || null } };
    }
    if (err && err.code === 'refresh_rejected') {
      throw new UserError('Claude rejected the login refresh. Open Claude Code and sign in again, then rerun this helper.');
    }
    throw err;
  }
}

async function publishLoginWait(deps, state, now, until) {
  const when = until ? ` Next login refresh attempt after ${until}.` : '';
  deps.log(`Waiting for Claude Code login.${when} The last known numbers stay on the phone.`);
  const config = await readConfig(deps.homeDir);
  if (!config) {
    deps.log('No phone topic yet, so the status was not sent.');
    return 0;
  }
  const snapshot = fitSnapshot(waitingSnapshot({
    now,
    timeZone: config.timeZone || 'Europe/London',
    lastSnapshot: state.lastSnapshot,
    history: state.history,
  }));
  const encrypted = Boolean(config.ntfyKey);
  await publishNtfy({
    server: config.ntfyServer,
    topic: dataTopic(config.ntfyTopic),
    title: 'Cluse',
    message: encrypted ? JSON.stringify(sealJson(config.ntfyKey, snapshot)) : JSON.stringify(snapshot),
    priority: 1,
    tags: ['snapshot'],
    token: config.ntfyToken,
    fetch: deps.fetch,
  });
  deps.log('Sent the last known numbers.');
  return 0;
}

async function storeState(deps, patch) {
  const file = appPaths(deps.homeDir).state;
  const latest = await loadState(file);
  await saveState(file, { ...latest, ...patch });
}

function usableAccess(creds, deps) {
  return Boolean(creds) && tokenStillValid(creds.expiresAt, currentTime(deps)) && expiryMs(creds.expiresAt) != null;
}

function tokenFingerprint(token) {
  return createHash('sha256').update(String(token)).digest('hex').slice(0, 16);
}

async function requestUsage(creds, deps) {
  const response = await fetchUsageResponse(creds.accessToken, deps);
  if (response.status === 401 || response.status === 403) return { kind: 'unauthorized' };
  if (response.status === 429) {
    const retryAfter = Number(response.headers?.get?.('retry-after'));
    const retryAfterSec = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1800;
    return { kind: 'rate-limited', retryAfterSec: Math.min(retryAfterSec, 6 * 3600) };
  }
  if (response.status < 200 || response.status >= 300 || !response.body) {
    throw new UserError(`Usage check failed (${response.status}). ${redact(response.text).slice(0, 180)}`);
  }
  return { kind: 'ok', body: response.body };
}

async function loadFixture(scenario) {
  const fixture = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'fixtures',
    `usage-${scenario}.json`,
  );
  try {
    const text = await fs.readFile(fixture, 'utf8');
    return { kind: 'ok', body: JSON.parse(text), subscriptionType: null, rateLimitTier: null };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new UserError(`Unknown sample scenario "${scenario}". Use before, after, fable, or legacy.`);
    }
    throw err;
  }
}

async function withRunLock(deps, fn) {
  const lockPath = appPaths(deps.homeDir).lock;
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  let handle;
  try {
    handle = await fs.open(lockPath, 'wx');
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    const stat = await fs.stat(lockPath).catch(() => null);
    if (stat && Date.now() - stat.mtimeMs < 5 * 60 * 1000) {
      deps.log('Another check is already running.');
      return 0;
    }
    await fs.rm(lockPath, { force: true });
    handle = await fs.open(lockPath, 'wx');
  }
  try {
    await handle.writeFile(String(process.pid));
    return await fn();
  } finally {
    await handle.close();
    await fs.rm(lockPath, { force: true });
  }
}

function intervalMinutes(args) {
  const minutes = args.intervalMinutes;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new UserError('--interval-minutes must be a positive number.');
  }
  if (!args.mock && minutes < 5) {
    throw new UserError('Use at least 5 minutes between live checks so the usage endpoint is not rate-limited.');
  }
  return minutes;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new UserError(`${flag} needs a value.`);
  return value;
}

function withDefaults(deps) {
  return {
    homeDir: deps.homeDir || os.homedir(),
    env: deps.env || process.env,
    platform: deps.platform || process.platform,
    fetch: deps.fetch || globalThis.fetch,
    now: deps.now ?? Date.now(),
    log: deps.log || ((message) => console.log(message)),
    error: deps.error || ((message) => console.error(message)),
    sleep: deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    security: deps.security,
    launchctl: deps.launchctl,
    execPath: deps.execPath,
    cliPath: deps.cliPath,
    uid: deps.uid,
  };
}

function currentTime(deps) {
  return typeof deps.now === 'function' ? deps.now() : deps.now;
}
