import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { main } from '../../helper/lib/main.js';
import { appPaths } from '../../helper/lib/paths.js';
import { latestSnapshot, parseNtfyLines } from './model.ts';
import { fetchLatestSnapshot, pollUrl } from './ntfy.ts';
import { widgetFromSnapshot } from './widget-data.ts';

test('a mock helper publish is returned by the app poll on ntfy.sh', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'plan-pace-live-'));
  const logs: string[] = [];
  const log = (line: unknown) => logs.push(String(line));
  assert.equal(await main(['--init'], { homeDir: home, platform: 'linux', env: {}, log, fetch: globalThis.fetch }), 0);
  const config = JSON.parse(await fs.readFile(appPaths(home).config, 'utf8')) as {
    ntfyServer: string;
    ntfyTopic: string;
    ntfyKey: string;
  };
  assert.ok(config.ntfyKey);
  assert.equal(
    await main(['--mock', '--scenario', 'before'], {
      homeDir: home,
      platform: 'linux',
      env: {},
      log,
      fetch: globalThis.fetch,
    }),
    0,
  );
  assert.match(logs.join('\n'), /Sent the usage update/);

  const snapshot = await waitForSnapshot(config.ntfyServer, config.ntfyTopic, config.ntfyKey);
  const session = snapshot.windows.find((window) => window.id === 'session');
  const weekly = snapshot.windows.find((window) => window.id === 'weekly');
  assert.equal(session?.usedPercent, 86);
  assert.equal(weekly?.usedPercent, 22);
  assert.equal(session?.resetsAt, '2026-10-01T17:00:00.000Z');
  assert.equal(weekly?.resetsAt, '2026-10-05T16:00:00.000Z');
  assert.equal(snapshot.plan, 'Sample');

  const widget = widgetFromSnapshot(snapshot, true);
  assert.equal(widget.sessionPercent, 86);
  assert.equal(widget.weeklyPercent, 22);
  assert.equal(widget.sessionReset, session?.resetsAt);
  assert.equal(widget.weeklyReset, weekly?.resetsAt);

  const base = await fetch(`${config.ntfyServer}/${config.ntfyTopic}/json?poll=1&since=12h`);
  assert.equal(base.ok, true);
  const bare = await base.text();
  assert.equal(latestSnapshot(parseNtfyLines(bare)), null);
  assert.equal(bare.includes('Sample'), false);

  const raw = await fetch(pollUrl(config.ntfyServer, config.ntfyTopic));
  const line = (await raw.text()).trim().split('\n').filter(Boolean).at(-1);
  assert.ok(line);
  const event = JSON.parse(line) as { topic?: string; title?: string; message?: string; time?: number; expires?: number };
  assert.equal(event.topic, `${config.ntfyTopic}-data`);
  assert.equal(event.title, 'Cluse');
  assert.equal(String(event.message).includes('Sample'), false);
  assert.equal(String(event.message).includes('usedPercent'), false);
  assert.equal(String(event.title).includes('%'), false);
  assert.ok(event.expires && event.time && event.expires - event.time >= 11 * 60 * 60);
});

async function waitForSnapshot(server: string, topic: string, key: string) {
  const deadline = Date.now() + 20000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const snapshot = await fetchLatestSnapshot(fetch, server, topic, key);
      if (snapshot) return snapshot;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No cached snapshot on the data topic. Last poll: ${JSON.stringify(last.slice(0, 240))}`);
}
