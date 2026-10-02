import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ensureFreshCredentials, loadCredentials } from '../lib/credentials.js';
import { main } from '../lib/main.js';
import { appPaths } from '../lib/paths.js';
import { openJson } from '../lib/seal.js';
import { emptyState, saveState } from '../lib/state.js';
import { parseRetryAfter, tokenBackoffDelay } from '../lib/token-backoff.js';

const NOW = Date.parse('2026-10-01T16:00:00.000Z');

test('token backoff grows and never waits less than Retry-After', () => {
  assert.equal(tokenBackoffDelay(1, null), 60 * 1000);
  assert.equal(tokenBackoffDelay(2, null), 120 * 1000);
  assert.equal(tokenBackoffDelay(3, null), 240 * 1000);
  assert.equal(tokenBackoffDelay(1, 120 * 1000), 120 * 1000);
  assert.equal(tokenBackoffDelay(1, 10 * 1000), 60 * 1000);
  assert.equal(tokenBackoffDelay(1, 24 * 60 * 60 * 1000), 6 * 60 * 60 * 1000);
  const headers = { get: (name) => (name.toLowerCase() === 'retry-after' ? '90' : null) };
  assert.equal(parseRetryAfter(headers, NOW), 90 * 1000);
  const dated = { get: () => 'Thu, 01 Oct 2026 16:05:00 GMT' };
  assert.equal(parseRetryAfter(dated, NOW), 5 * 60 * 1000);
});

test('a 429 is remembered, blocks another refresh, and does not change the login', async () => {
  const home = await tempHome();
  const file = await writeLogin(home, NOW - 1000);
  const before = await fs.readFile(file, 'utf8');
  const loaded = await loadCredentials(linuxDeps(home, NOW));
  const calls = [];
  const deps = {
    ...linuxDeps(home, NOW),
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return http(429, { error: { type: 'rate_limit_error' } }, { 'retry-after': '120' });
    },
  };
  await assert.rejects(() => ensureFreshCredentials(loaded, deps), (err) => err.code === 'refresh_deferred');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /platform\.claude\.com/);
  assert.equal(calls[0].options.headers['User-Agent'], 'claude-code/2.1.80');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    grant_type: 'refresh_token',
    refresh_token: 'sk-ant-ort01-old',
    client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
  });
  assert.equal(await fs.readFile(file, 'utf8'), before);
  const state = JSON.parse(await fs.readFile(appPaths(home).state, 'utf8'));
  assert.equal(state.tokenBackoffUntil, new Date(NOW + 120 * 1000).toISOString());
  assert.equal(state.tokenBackoffAttempt, 1);

  let again = 0;
  await assert.rejects(
    () => ensureFreshCredentials(loaded, {
      ...linuxDeps(home, NOW + 30 * 1000),
      fetch: async () => {
        again += 1;
        throw new Error('token endpoint must not be called inside the backoff window');
      },
    }),
    (err) => err.code === 'refresh_deferred' && err.until === state.tokenBackoffUntil,
  );
  assert.equal(again, 0);

  const later = Date.parse(state.tokenBackoffUntil) + 1000;
  let after = 0;
  await assert.rejects(
    () => ensureFreshCredentials(loaded, {
      ...linuxDeps(home, later),
      fetch: async () => {
        after += 1;
        return http(429, { error: { type: 'rate_limit_error' } });
      },
    }),
    (err) => err.code === 'refresh_deferred',
  );
  assert.equal(after, 1);
  const grown = JSON.parse(await fs.readFile(appPaths(home).state, 'utf8'));
  assert.equal(grown.tokenBackoffAttempt, 2);
  assert.equal(grown.tokenBackoffUntil, new Date(later + 120 * 1000).toISOString());
});

test('a Keychain login refreshed by Claude Code is picked up without a token request', async () => {
  const home = await tempHome();
  let reads = 0;
  const expired = login('sk-ant-oat01-old', 'sk-ant-ort01-old', NOW - 1000);
  const fresh = login('sk-ant-oat01-fromclaude', 'sk-ant-ort01-fromclaude', NOW + 60 * 60 * 1000);
  const deps = {
    homeDir: home,
    platform: 'darwin',
    env: { USER: 'ed' },
    now: NOW,
    security: async (args) => {
      if (args[0] === 'add-generic-password') throw new Error('the Keychain must not be written');
      if (args.includes('-w')) {
        reads += 1;
        return JSON.stringify(reads === 1 ? expired : fresh);
      }
      return '"acct"<blob>="ed"';
    },
    fetch: async () => {
      throw new Error('token endpoint must not be called');
    },
  };
  const loaded = await loadCredentials(deps);
  assert.equal(loaded.accessToken, 'sk-ant-oat01-old');
  const saved = await ensureFreshCredentials(loaded, deps);
  assert.equal(saved.accessToken, 'sk-ant-oat01-fromclaude');
  assert.equal(saved.source, 'keychain');
  assert.equal(reads, 2);
});

test('a Keychain refresh during the backoff window is used without calling the token endpoint', async () => {
  const home = await tempHome();
  const fresh = login('sk-ant-oat01-fromclaude', 'sk-ant-ort01-fromclaude', NOW + 60 * 60 * 1000);
  await saveState(appPaths(home).state, {
    ...emptyState(),
    tokenBackoffUntil: new Date(NOW + 60 * 60 * 1000).toISOString(),
    tokenBackoffAttempt: 3,
  });
  const deps = {
    homeDir: home,
    platform: 'darwin',
    env: { USER: 'ed' },
    now: NOW,
    security: async (args) => {
      if (args[0] === 'add-generic-password') throw new Error('the Keychain must not be written');
      if (args.includes('-w')) return JSON.stringify(fresh);
      return '"acct"<blob>="ed"';
    },
    fetch: async () => {
      throw new Error('token endpoint must not be called');
    },
  };
  const loaded = await loadCredentials(deps);
  const saved = await ensureFreshCredentials({ ...loaded, expiresAt: NOW - 1000, accessToken: 'sk-ant-oat01-old' }, deps);
  assert.equal(saved.accessToken, 'sk-ant-oat01-fromclaude');
});

test('a newer credentials file is used instead of refreshing a stale Keychain', async () => {
  const home = await tempHome();
  const file = path.join(home, '.claude', '.credentials.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(login('sk-ant-oat01-fromfile', 'sk-ant-ort01-file', NOW + 2 * 60 * 60 * 1000)));
  const deps = {
    homeDir: home,
    platform: 'darwin',
    env: { USER: 'ed' },
    now: NOW,
    security: async (args) => {
      if (args[0] === 'add-generic-password') throw new Error('the Keychain must not be written');
      if (args.includes('-w')) return JSON.stringify(login('sk-ant-oat01-stale', 'sk-ant-ort01-stale', NOW - 1000));
      return '"acct"<blob>="ed"';
    },
    fetch: async () => {
      throw new Error('token endpoint must not be called');
    },
  };
  const loaded = await loadCredentials(deps);
  const saved = await ensureFreshCredentials(loaded, deps);
  assert.equal(saved.accessToken, 'sk-ant-oat01-fromfile');
  assert.equal(saved.source, 'file');
});

test('a Keychain refresh writes the full Claude Code object and keeps the other fields', async () => {
  const home = await tempHome();
  let written = null;
  const original = {
    mcpOAuth: { keep: true },
    claudeAiOauth: {
      accessToken: 'sk-ant-oat01-old',
      refreshToken: 'sk-ant-ort01-old',
      expiresAt: NOW - 1000,
      subscriptionType: 'max',
      scopes: ['user:inference', 'user:profile'],
    },
  };
  const deps = {
    homeDir: home,
    platform: 'darwin',
    env: { USER: 'ed' },
    now: NOW,
    security: async (args) => {
      if (args[0] === 'add-generic-password') {
        written = args[args.indexOf('-w') + 1];
        return '';
      }
      if (args.includes('-w')) return JSON.stringify(original);
      return '"acct"<blob>="ed"';
    },
    fetch: async () => http(200, {
      access_token: 'sk-ant-oat01-new',
      refresh_token: 'sk-ant-ort01-new',
      expires_in: 28800,
    }),
  };
  const loaded = await loadCredentials(deps);
  const saved = await ensureFreshCredentials(loaded, deps);
  assert.equal(saved.accessToken, 'sk-ant-oat01-new');
  const parsed = JSON.parse(written);
  assert.equal(parsed.mcpOAuth.keep, true);
  assert.deepEqual(parsed.claudeAiOauth.scopes, ['user:inference', 'user:profile']);
  assert.equal(parsed.claudeAiOauth.subscriptionType, 'max');
  assert.equal(parsed.claudeAiOauth.refreshToken, 'sk-ant-ort01-new');
  assert.equal(parsed.claudeAiOauth.expiresAt, NOW + 28800 * 1000);
});

test('a rate-limited login still publishes the last numbers and does not ask again', async () => {
  const home = await tempHome();
  const published = [];
  const tokenCalls = [];
  await main(['--init'], baseDeps(home, published));
  const key = JSON.parse(await fs.readFile(appPaths(home).config, 'utf8')).ntfyKey;
  await writeLogin(home, NOW - 60 * 1000);
  await saveState(appPaths(home).state, {
    ...emptyState(),
    mode: 'live',
    lastSnapshot: {
      fetchedAt: '2026-10-01T12:50:00.000Z',
      plan: 'Max 5x',
      windows: [{
        id: 'session',
        label: '5-hour session',
        shortLabel: '5h',
        usedPercent: 86,
        resetsAt: '2026-10-01T17:00:00.000Z',
        severity: null,
      }],
      extraUsageLabel: null,
    },
    history: [{ t: '2026-10-01T12:50:00.000Z', w: { session: 86 } }],
  });
  const deps = {
    ...baseDeps(home, published),
    fetch: async (url, options) => {
      const target = String(url);
      if (target.includes('/v1/oauth/token')) {
        tokenCalls.push(target);
        return http(429, { error: { type: 'rate_limit_error' } }, { 'retry-after': '600' });
      }
      if (target.includes('/api/oauth/usage')) throw new Error('usage must not be called with an expired token');
      const body = options?.body ? JSON.parse(options.body) : null;
      if (body) published.push(body);
      return http(200, { id: 'ok' });
    },
  };
  assert.equal(await main([], deps), 0);
  assert.equal(tokenCalls.length, 1);
  assert.equal(published.length, 1);
  assert.equal(published[0].message.includes('waiting for Claude Code login'), false);
  assert.equal(published[0].message.includes('usedPercent'), false);
  const snapshot = openJson(key, JSON.parse(published[0].message));
  assert.equal(snapshot.status, 'waiting-login');
  assert.equal(snapshot.notice, 'waiting for Claude Code login');
  assert.equal(snapshot.fetchedAt, '2026-10-01T12:50:00.000Z');
  assert.equal(snapshot.windows[0].usedPercent, 86);
  assert.equal(snapshot.plan, 'Max 5x');

  published.length = 0;
  assert.equal(await main([], deps), 0);
  assert.equal(tokenCalls.length, 1);
  assert.equal(published.length, 1);
  const again = openJson(key, JSON.parse(published[0].message));
  assert.equal(again.status, 'waiting-login');
  assert.equal(again.windows[0].usedPercent, 86);
});

function linuxDeps(home, now) {
  return { homeDir: home, platform: 'linux', env: {}, now };
}

function baseDeps(home, published) {
  return {
    homeDir: home,
    platform: 'linux',
    env: {},
    now: NOW,
    log: () => {},
    error: () => {},
    fetch: async (url, options) => {
      const body = options?.body ? JSON.parse(options.body) : null;
      if (body) published.push(body);
      return http(200, { id: 'ok' });
    },
  };
}

function login(accessToken, refreshToken, expiresAt) {
  return {
    claudeAiOauth: {
      accessToken,
      refreshToken,
      expiresAt,
      subscriptionType: 'max',
    },
  };
}

async function writeLogin(home, expiresAt) {
  const file = path.join(home, '.claude', '.credentials.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(login('sk-ant-oat01-old', 'sk-ant-ort01-old', expiresAt)));
  return file;
}

async function tempHome() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'claude-usage-'));
}

function http(status, body, headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower[String(name).toLowerCase()] ?? null },
    text: async () => text,
  };
}
