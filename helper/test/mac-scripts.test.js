import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const read = (name) => fs.readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('the Mac uninstaller removes the launch agent, both folders and the logs', async () => {
  const sh = await read('uninstall-mac.sh');
  assert.match(sh, /LABEL="com\.claude-usage-alert"/);
  assert.match(sh, /launchctl bootout/);
  assert.match(sh, /Library\/LaunchAgents\/\$\{LABEL\}\.plist/);
  assert.match(sh, /\.plan-pace"/);
  assert.match(sh, /\.claude-usage-alert"/);
  assert.match(sh, /Library\/Logs\/claude-usage-alert\.log"/);
  assert.match(sh, /Library\/Logs\/claude-usage-alert\.err\.log"/);
  const bootstrap = await read('bootstrap-mac.sh');
  assert.match(bootstrap, /uninstall-mac\.sh/);
});

test('the Mac uninstaller label matches the installer', async () => {
  const { LAUNCH_AGENT_LABEL } = await import('../lib/install.js');
  const sh = await read('uninstall-mac.sh');
  assert.ok(sh.includes(`LABEL="${LAUNCH_AGENT_LABEL}"`));
});
