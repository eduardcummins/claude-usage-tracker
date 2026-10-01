import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { appPaths } from '../lib/paths.js';
import { main } from '../lib/main.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const NOW = Date.parse('2026-10-01T16:00:00.000Z');

test('mock dry-run prints sample usage and does not save or send', async () => {
  const home = await tempHome();
  const published = [];
  const logs = [];
  const code = await main(['--mock', '--dry-run'], deps(home, published, logs));
  assert.equal(code, 0);
  assert.equal(published.length, 0);
  assert.match(logs.join('\n'), /86%/);
  await assert.rejects(() => fs.stat(appPaths(home).state));
});

test('two mock scenarios publish a snapshot and then one reset alert', async () => {
  const home = await tempHome();
  const published = [];
  const logs = [];
  await main(['--init'], deps(home, published, logs));
  await main(['--mock', '--scenario', 'before'], deps(home, published, logs));
  assert.equal(published.length, 1);
  assert.equal(published[0].priority, 1);
  assert.equal(published[0].tags[0], 'snapshot');
  assert.match(published[0].topic, /-data$/);
  const snapshot = JSON.parse(published[0].message);
  assert.equal(snapshot.windows[0].usedPercent, 86);
  assert.equal(snapshot.extraUsageLabel, 'Extra usage: $2.50 of $1000.00');
  assert.doesNotMatch(JSON.stringify(published), /sk-ant-/);

  published.length = 0;
  await main(['--mock', '--scenario', 'after'], deps(home, published, logs));
  assert.equal(published.length, 2);
  const alert = published.find((message) => message.tags.includes('reset'));
  assert.equal(alert.priority, 5);
  assert.match(alert.message, /23:00/);
  assert.match(alert.message, /UK time/);
  assert.doesNotMatch(alert.topic, /-data$/);

  published.length = 0;
  await main(['--mock', '--scenario', 'after'], deps(home, published, logs));
  assert.equal(published.filter((message) => message.tags.includes('reset')).length, 0);
});

test('switching from sample data to a live check does not fire a false reset', async () => {
  const home = await tempHome();
  const published = [];
  await main(['--init'], deps(home, published, []));
  await writeLogin(home);
  await main(['--mock', '--scenario', 'before'], deps(home, published, []));
  published.length = 0;
  const after = JSON.parse(await fs.readFile(path.join(fixtures, 'usage-after.json'), 'utf8'));
  await main([], liveDeps(home, published, after));
  assert.equal(published.filter((message) => (message.tags || []).includes('reset')).length, 0);

  published.length = 0;
  const later = {
    limits: [
      { kind: 'session', percent: 1, resets_at: '2026-10-02T03:00:00Z' },
      { kind: 'weekly_all', percent: 22, resets_at: '2026-10-05T16:00:00Z' },
    ],
  };
  await main([], liveDeps(home, published, later));
  assert.equal(published.filter((message) => message.tags.includes('reset')).length, 1);
});

test('doctor reads a login file and does not contact ntfy', async () => {
  const home = await tempHome();
  await writeLogin(home);
  const logs = [];
  const before = JSON.parse(await fs.readFile(path.join(fixtures, 'usage-before.json'), 'utf8'));
  const code = await main(['--doctor'], {
    ...liveDeps(home, [], before),
    log: (line) => logs.push(line),
    fetch: async (url) => {
      if (String(url).includes('ntfy')) throw new Error('doctor must not publish');
      if (String(url).includes('/api/oauth/usage')) return http(200, before);
      throw new Error(`unexpected ${url}`);
    },
  });
  assert.equal(code, 0);
  assert.match(logs.join('\n'), /86%/);
  assert.match(logs.join('\n'), /Nothing was sent/);
  await assert.rejects(() => fs.stat(appPaths(home).state));
});

test('a usage error that echoes a token is redacted', async () => {
  const home = await tempHome();
  await writeLogin(home);
  await main(['--init'], deps(home, [], []));
  await assert.rejects(
    () => main([], {
      ...deps(home, [], []),
      platform: 'linux',
      fetch: async (url) => {
        if (String(url).includes('/api/oauth/usage')) {
          return http(500, 'bad sk-ant-oat01-SUPERSECRET');
        }
        throw new Error(`unexpected ${url}`);
      },
    }),
    (err) => {
      assert.match(err.message, /sk-ant-\[redacted\]/);
      assert.doesNotMatch(err.message, /SUPERSECRET/);
      return true;
    },
  );
});

test('--init keeps the same topic unless rotate is asked for', async () => {
  const home = await tempHome();
  const logs = [];
  await main(['--init'], deps(home, [], logs));
  const first = JSON.parse(await fs.readFile(appPaths(home).config, 'utf8')).ntfyTopic;
  logs.length = 0;
  await main(['--init'], deps(home, [], logs));
  const second = JSON.parse(await fs.readFile(appPaths(home).config, 'utf8')).ntfyTopic;
  assert.equal(first, second);
  await main(['--init', '--rotate'], deps(home, [], logs));
  const third = JSON.parse(await fs.readFile(appPaths(home).config, 'utf8')).ntfyTopic;
  assert.notEqual(second, third);
});

function deps(home, published, logs) {
  return {
    homeDir: home,
    platform: 'linux',
    env: {},
    now: NOW,
    log: (line) => logs.push(String(line)),
    error: () => {},
    fetch: async (url, options) => {
      const body = options?.body ? JSON.parse(options.body) : null;
      if (body) published.push(body);
      return http(200, { id: 'ok' });
    },
  };
}

function liveDeps(home, published, usageBody) {
  return {
    ...deps(home, published, []),
    fetch: async (url, options) => {
      const target = String(url);
      if (target.includes('/api/oauth/usage')) return http(200, usageBody);
      if (target.includes('/v1/oauth/token')) throw new Error('token was still valid');
      const body = options?.body ? JSON.parse(options.body) : null;
      if (body) published.push(body);
      return http(200, { id: 'ok' });
    },
  };
}

async function writeLogin(home) {
  const file = path.join(home, '.claude', '.credentials.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({
    claudeAiOauth: {
      accessToken: 'sk-ant-oat01-testtokenvalue',
      refreshToken: 'sk-ant-ort01-testtokenvalue',
      expiresAt: NOW + 60 * 60 * 1000,
      subscriptionType: 'max',
      rateLimitTier: 'default_claude_max_5x',
    },
  }));
}

async function tempHome() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'claude-usage-'));
}

function http(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => text,
  };
}
