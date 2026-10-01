import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ensureFreshCredentials, extractJson, loadCredentials, parseKeychainAccount } from '../lib/credentials.js';
import { redact } from '../lib/redact.js';

const NOW = Date.parse('2026-10-01T16:00:00.000Z');

test('keychain account and JSON extraction', () => {
  assert.equal(parseKeychainAccount('    "acct"<blob>="ed"\n'), 'ed');
  assert.equal(extractJson('warning\n{"claudeAiOauth":{"accessToken":"abc"}}').claudeAiOauth.accessToken, 'abc');
});

test('tokens are redacted before anything is printed', () => {
  assert.equal(redact('failed sk-ant-oat01-SUPERSECRET tail'), 'failed sk-ant-[redacted] tail');
});

test('macOS prefers the Keychain over a stale credentials file', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-usage-'));
  const file = path.join(home, '.claude', '.credentials.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({
    claudeAiOauth: { accessToken: 'sk-ant-oat01-fromfile', refreshToken: 'sk-ant-ort01-file', expiresAt: NOW + 3600000 },
  }));
  const keychain = {
    claudeAiOauth: {
      accessToken: 'sk-ant-oat01-fromkeychain',
      refreshToken: 'sk-ant-ort01-keychain',
      expiresAt: NOW + 3600000,
      subscriptionType: 'max',
      rateLimitTier: 'default_claude_max_5x',
    },
    mcpOAuth: { keep: true },
  };
  const loaded = await loadCredentials({
    homeDir: home,
    platform: 'darwin',
    env: { USER: 'ed' },
    now: NOW,
    security: async (args) => {
      if (args.includes('-w')) return JSON.stringify(keychain);
      return '"acct"<blob>="ed"';
    },
  });
  assert.equal(loaded.source, 'keychain');
  assert.equal(loaded.accessToken, 'sk-ant-oat01-fromkeychain');
  assert.equal(loaded.account, 'ed');
});

test('an expired file login is refreshed and other fields are kept', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-usage-'));
  const file = path.join(home, '.claude', '.credentials.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const original = {
    mcpOAuth: { keep: true },
    claudeAiOauth: {
      accessToken: 'sk-ant-oat01-old',
      refreshToken: 'sk-ant-ort01-old',
      expiresAt: NOW - 1000,
      subscriptionType: 'pro',
      scopes: ['user:inference'],
    },
  };
  await fs.writeFile(file, JSON.stringify(original));
  let refreshed = false;
  const loaded = await loadCredentials({ homeDir: home, platform: 'linux', env: {}, now: NOW });
  const saved = await ensureFreshCredentials(loaded, {
    homeDir: home,
    platform: 'linux',
    env: {},
    now: NOW,
    fetch: async (url) => {
      assert.match(String(url), /\/v1\/oauth\/token$/);
      refreshed = true;
      return http(200, {
        access_token: 'sk-ant-oat01-new',
        refresh_token: 'sk-ant-ort01-new',
        expires_in: 28800,
      });
    },
  });
  assert.equal(refreshed, true);
  assert.equal(saved.accessToken, 'sk-ant-oat01-new');
  const written = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(written.mcpOAuth.keep, true);
  assert.deepEqual(written.claudeAiOauth.scopes, ['user:inference']);
  assert.equal(written.claudeAiOauth.refreshToken, 'sk-ant-ort01-new');
  assert.equal(written.claudeAiOauth.expiresAt, NOW + 28800 * 1000);
});

test('a rejected refresh does not change the saved login', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-usage-'));
  const file = path.join(home, '.claude', '.credentials.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const original = {
    claudeAiOauth: {
      accessToken: 'sk-ant-oat01-old',
      refreshToken: 'sk-ant-ort01-old',
      expiresAt: NOW - 1000,
    },
  };
  await fs.writeFile(file, JSON.stringify(original));
  const before = await fs.readFile(file, 'utf8');
  const loaded = await loadCredentials({ homeDir: home, platform: 'linux', env: {}, now: NOW });
  await assert.rejects(
    () => ensureFreshCredentials(loaded, {
      homeDir: home,
      platform: 'linux',
      env: {},
      now: NOW,
      fetch: async () => http(400, { error: 'invalid_grant' }),
    }),
    (err) => err.code === 'refresh_rejected',
  );
  assert.equal(await fs.readFile(file, 'utf8'), before);
});

test('a valid token is not refreshed', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-usage-'));
  const file = path.join(home, '.claude', '.credentials.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({
    claudeAiOauth: {
      accessToken: 'sk-ant-oat01-current',
      refreshToken: 'sk-ant-ort01-current',
      expiresAt: NOW + 60 * 60 * 1000,
    },
  }));
  const loaded = await loadCredentials({ homeDir: home, platform: 'linux', env: {}, now: NOW });
  const same = await ensureFreshCredentials(loaded, {
    homeDir: home,
    platform: 'linux',
    env: {},
    now: NOW,
    fetch: async () => {
      throw new Error('refresh should not be called');
    },
  });
  assert.equal(same.accessToken, 'sk-ant-oat01-current');
});

function http(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  };
}
