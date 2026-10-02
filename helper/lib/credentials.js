import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UserError } from './errors.js';
import { appPaths, credentialsPath } from './paths.js';
import { redact } from './redact.js';
import { refreshAccessToken } from './oauth.js';
import { loadState, saveState } from './state.js';
import { tokenBackoffDelay } from './token-backoff.js';
import { expiryMs, tokenStillValid } from './time.js';

const KEYCHAIN_SERVICE = 'Claude Code-credentials';

export function applyToken(raw, tokenResponse, now) {
  if (!tokenResponse || !tokenResponse.access_token) {
    throw new Error('Refusing to save a Claude login with no access token.');
  }
  const oauth = { ...(raw.claudeAiOauth || {}) };
  oauth.accessToken = tokenResponse.access_token;
  if (tokenResponse.refresh_token) oauth.refreshToken = tokenResponse.refresh_token;
  const expiresIn = Number(tokenResponse.expires_in);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    oauth.expiresAt = now + expiresIn * 1000;
  }
  return { ...raw, claudeAiOauth: oauth };
}

export function extractJson(text) {
  const start = String(text).indexOf('{');
  if (start < 0) return null;
  try {
    return JSON.parse(String(text).slice(start));
  } catch {
    return null;
  }
}

export function parseKeychainAccount(dump) {
  const match = String(dump).match(/"acct"<blob>="([^"]*)"/);
  return match ? match[1] : null;
}

export function pickFreshest(candidates) {
  let best = null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!best) {
      best = candidate;
      continue;
    }
    const bestExp = expiryMs(best.expiresAt);
    const nextExp = expiryMs(candidate.expiresAt);
    if (nextExp == null) continue;
    if (bestExp == null || nextExp >= bestExp) best = candidate;
  }
  return best;
}

export async function loadCredentials(deps) {
  const stores = await loadStores(deps);
  return stores.freshest;
}

export async function ensureFreshCredentials(loaded, deps, { force = false } = {}) {
  if (!loaded) return null;
  const now = currentTime(deps);
  if (!force && usable(loaded, now)) return loaded;
  return withRefreshLock(deps, async () => {
    const stores = await loadStores(deps);
    const current = stores.freshest || loaded;
    const now2 = currentTime(deps);
    const rotated = force && current.accessToken !== loaded.accessToken;
    if (rotated && usable(current, now2)) return current;
    if (!force && usable(current, now2)) return current;
    if (!current.refreshToken) {
      throw deferred(null);
    }
    const backoff = await readTokenBackoff(deps);
    if (backoff.until && Date.parse(backoff.until) > now2) {
      throw deferred(backoff.until);
    }
    let tokenResponse;
    try {
      tokenResponse = await refreshAccessToken(current.refreshToken, deps);
    } catch (err) {
      if (err && err.code === 'refresh_rate_limited') {
        const until = await persistTokenBackoff(deps, now2, err.retryAfterMs);
        throw deferred(until);
      }
      if (err && err.code === 'refresh_rejected') {
        const rescued = await loadStores(deps);
        const newer = rescued.freshest;
        if (newer && newer.accessToken !== current.accessToken && usable(newer, currentTime(deps))) {
          return newer;
        }
      }
      throw err;
    }
    return saveRefreshed(stores, current, tokenResponse, deps);
  });
}

export async function saveCredentials(loaded, tokenResponse, deps) {
  const next = applyToken(loaded.raw, tokenResponse, currentTime(deps));
  if (loaded.source === 'keychain') {
    await writeKeychain(next, loaded.account, deps);
    return decorate(next, 'keychain', { account: loaded.account });
  }
  await writeFileStore(loaded.filePath, next);
  return decorate(next, 'file', { filePath: loaded.filePath });
}

async function loadStores(deps) {
  const file = await readFileStore(deps);
  const keychain = deps.platform === 'darwin' ? await readKeychain(deps) : null;
  const fileCred = file ? decorate(file.raw, 'file', { filePath: file.filePath }) : null;
  const keyCred = keychain ? decorate(keychain.raw, 'keychain', { account: keychain.account }) : null;
  // File first, Keychain last: an equal expiry stays in the Keychain, which is where Claude Code reads it.
  return {
    file: fileCred,
    keychain: keyCred,
    freshest: pickFreshest([fileCred, keyCred]),
  };
}

async function saveRefreshed(stores, current, tokenResponse, deps) {
  const consumed = current.refreshToken;
  const now = currentTime(deps);
  const next = applyToken(current.raw, tokenResponse, now);
  if (current.source === 'keychain') {
    await writeKeychain(next, current.account, deps);
  } else {
    await writeFileStore(current.filePath, next);
  }
  // Update the other copy only when it held the refresh token we just used.
  // A different token is left alone so a stale copy cannot be rotated out from under Claude Code.
  if (stores.keychain && current.source !== 'keychain' && stores.keychain.refreshToken === consumed) {
    await writeKeychain(applyToken(stores.keychain.raw, tokenResponse, now), stores.keychain.account, deps);
  }
  if (stores.file && current.source !== 'file' && stores.file.refreshToken === consumed) {
    await writeFileStore(stores.file.filePath, applyToken(stores.file.raw, tokenResponse, now));
  }
  await clearTokenBackoff(deps);
  if (current.source === 'keychain') return decorate(next, 'keychain', { account: current.account });
  return decorate(next, 'file', { filePath: current.filePath });
}

async function readTokenBackoff(deps) {
  const state = await loadState(appPaths(deps.homeDir).state);
  return { until: state.tokenBackoffUntil, attempt: state.tokenBackoffAttempt || 0 };
}

async function persistTokenBackoff(deps, now, retryAfterMs) {
  const file = appPaths(deps.homeDir).state;
  const state = await loadState(file);
  const attempt = (state.tokenBackoffAttempt || 0) + 1;
  const until = new Date(now + tokenBackoffDelay(attempt, retryAfterMs)).toISOString();
  await saveState(file, {
    ...state,
    tokenBackoffUntil: until,
    tokenBackoffAttempt: attempt,
  });
  return until;
}

async function clearTokenBackoff(deps) {
  const file = appPaths(deps.homeDir).state;
  const state = await loadState(file);
  if (!state.tokenBackoffUntil && !state.tokenBackoffAttempt) return;
  await saveState(file, { ...state, tokenBackoffUntil: null, tokenBackoffAttempt: 0 });
}

function usable(loaded, now) {
  return tokenStillValid(loaded.expiresAt, now) && expiryMs(loaded.expiresAt) != null;
}

function deferred(until) {
  const error = new Error('Claude login refresh is waiting after a rate limit.');
  error.code = 'refresh_deferred';
  error.until = until;
  return error;
}

async function readKeychain(deps) {
  let stdout;
  try {
    stdout = await security(['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'], deps);
  } catch {
    return null;
  }
  const json = extractJson(stdout);
  if (!json?.claudeAiOauth?.accessToken) return null;
  let account = deps.env?.USER || deps.env?.LOGNAME || null;
  try {
    const dump = await security(['find-generic-password', '-s', KEYCHAIN_SERVICE], deps);
    account = parseKeychainAccount(dump) || account;
  } catch {
    // The password read already succeeded. The account name is only needed when saving.
  }
  return { raw: json, account };
}

async function writeKeychain(data, account, deps) {
  const acct = account || deps.env?.USER || deps.env?.LOGNAME;
  if (!acct) {
    throw new UserError('Could not find the macOS Keychain account name for Claude Code.');
  }
  await security([
    'add-generic-password',
    '-U',
    '-s',
    KEYCHAIN_SERVICE,
    '-a',
    acct,
    '-w',
    JSON.stringify(data),
  ], deps);
}

async function readFileStore(deps) {
  const filePath = credentialsPath(deps.homeDir, deps.env || {});
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(text);
    if (!json?.claudeAiOauth?.accessToken) return null;
    return { raw: json, filePath };
  } catch {
    return null;
  }
}

async function writeFileStore(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await fs.rename(tmp, filePath);
  await fs.chmod(filePath, 0o600).catch(() => {});
}

function decorate(raw, source, extra) {
  const oauth = raw.claudeAiOauth;
  return {
    source,
    raw,
    accessToken: oauth.accessToken,
    refreshToken: oauth.refreshToken || null,
    expiresAt: oauth.expiresAt ?? null,
    subscriptionType: oauth.subscriptionType || null,
    rateLimitTier: oauth.rateLimitTier || null,
    ...extra,
  };
}

async function security(args, deps) {
  if (deps.security) return deps.security(args);
  return execFileText('/usr/bin/security', args);
}

function execFileText(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 15000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const error = new Error(redact(stderr || err.message));
        error.code = err.code;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function withRefreshLock(deps, fn) {
  const lockPath = appPaths(deps.homeDir).refreshLock;
  await fs.mkdir(appPaths(deps.homeDir).root, { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(String(process.pid));
      await handle.close();
      try {
        return await fn();
      } finally {
        await fs.rm(lockPath, { force: true });
      }
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const stat = await fs.stat(lockPath).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > 60000) {
        await fs.rm(lockPath, { force: true });
        continue;
      }
      if (Date.now() - started > 15000) {
        throw new UserError('Another check is refreshing the Claude login. The next run will try again.');
      }
      await delay(deps, 300);
    }
  }
}

function currentTime(deps) {
  if (typeof deps.now === 'function') return deps.now();
  return deps.now ?? Date.now();
}

function delay(deps, ms) {
  if (deps.sleep) return deps.sleep(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
