import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UserError } from './errors.js';
import { appPaths, credentialsPath } from './paths.js';
import { redact } from './redact.js';
import { refreshAccessToken } from './oauth.js';
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

export async function loadCredentials(deps) {
  if (deps.platform === 'darwin') {
    const keychain = await readKeychain(deps);
    if (keychain) return decorate(keychain.raw, 'keychain', { account: keychain.account });
  }
  const file = await readFileStore(deps);
  if (file) return decorate(file.raw, 'file', { filePath: file.filePath });
  return null;
}

export async function ensureFreshCredentials(loaded, deps, { force = false } = {}) {
  if (!loaded) return null;
  const now = currentTime(deps);
  if (!force && tokenStillValid(loaded.expiresAt, now) && expiryMs(loaded.expiresAt) != null) {
    return loaded;
  }
  if (!loaded.refreshToken) return loaded;
  return withRefreshLock(deps, async () => {
    const again = await loadCredentials(deps);
    const current = again || loaded;
    const now2 = currentTime(deps);
    const rotated = force && again && again.accessToken !== loaded.accessToken;
    if (rotated && tokenStillValid(current.expiresAt, now2)) return current;
    if (!force && tokenStillValid(current.expiresAt, now2) && expiryMs(current.expiresAt) != null) {
      return current;
    }
    if (!current.refreshToken) return current;
    const tokenResponse = await refreshAccessToken(current.refreshToken, deps);
    return saveCredentials(current, tokenResponse, deps);
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
