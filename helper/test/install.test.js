import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { UserError } from '../lib/errors.js';
import { buildLaunchAgentPlist, installMac, plistPath, uninstallMac } from '../lib/install.js';
import { main } from '../lib/main.js';

test('the launchd plist checks every 10 minutes and escapes paths', () => {
  const xml = buildLaunchAgentPlist({
    nodePath: '/opt/homebrew/bin/node',
    scriptPath: '/Users/ed/My & Projects/cli.js',
    homeDir: '/Users/ed',
  });
  assert.match(xml, /<integer>600<\/integer>/);
  assert.match(xml, /com\.claude-usage-alert/);
  assert.match(xml, /LimitLoadToSessionType/);
  assert.match(xml, /Aqua/);
  assert.match(xml, /My &amp; Projects\/cli\.js/);
  assert.match(xml, /\/opt\/homebrew\/bin\/node/);
  assert.match(xml, /claude-usage-alert\.log/);
});

test('install-mac writes the agent and bootstraps it', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-usage-'));
  const calls = [];
  await installMac({
    platform: 'darwin',
    homeDir: home,
    uid: 501,
    execPath: '/opt/homebrew/bin/node',
    cliPath: '/Users/ed/helper/cli.js',
    log: () => {},
    launchctl: async (args) => {
      calls.push(args);
    },
  });
  const xml = await fs.readFile(plistPath(home), 'utf8');
  assert.match(xml, /\/opt\/homebrew\/bin\/node/);
  assert.deepEqual(calls[0].slice(0, 2), ['bootout', 'gui/501']);
  assert.deepEqual(calls[1].slice(0, 2), ['bootstrap', 'gui/501']);
  await uninstallMac({
    platform: 'darwin',
    homeDir: home,
    uid: 501,
    log: () => {},
    launchctl: async () => {},
  });
  await assert.rejects(() => fs.stat(plistPath(home)));
});

test('install-mac refuses to run on Windows or Linux', async () => {
  await assert.rejects(
    () => main(['install-mac'], { platform: 'win32', homeDir: os.tmpdir(), log: () => {} }),
    (err) => err instanceof UserError && /Windows/.test(err.message),
  );
});
