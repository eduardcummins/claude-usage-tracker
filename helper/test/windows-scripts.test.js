import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const read = (name) => fs.readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('the Windows task runs node through a hidden VBScript launcher', async () => {
  const ps = await read('install-windows.ps1');
  assert.match(ps, /run-hidden\.vbs/);
  assert.match(ps, /System32\\wscript\.exe/);
  assert.match(ps, /\/\/B/);
  assert.match(ps, /WScript\.Shell/);
  assert.match(ps, /, 0, True/);
  assert.match(ps, /-Encoding Unicode/);
  assert.doesNotMatch(ps, /-Execute \$node/);
  assert.doesNotMatch(ps, /-WindowStyle Hidden/i);
});

test('re-running the Windows installer replaces the task', async () => {
  const ps = await read('install-windows.ps1');
  assert.match(ps, /Unregister-ScheduledTask -TaskName \$taskName -Confirm:\$false/);
  assert.match(ps, /Register-ScheduledTask[\s\S]*-Force/);
  assert.match(ps, /\$taskName = "ClaudeUsageAlert"/);
});

test('the Windows uninstaller removes the task and both folders', async () => {
  const ps = await read('uninstall-windows.ps1');
  assert.match(ps, /\$taskName = "ClaudeUsageAlert"/);
  assert.match(ps, /Unregister-ScheduledTask/);
  assert.match(ps, /"\.plan-pace"/);
  assert.match(ps, /"\.claude-usage-alert"/);
  const bootstrap = await read('bootstrap-windows.ps1');
  assert.match(bootstrap, /uninstall-windows\.ps1/);
});

test('the VBScript quoting doubles quotes around paths with spaces', () => {
  // Mirrors the quoting in install-windows.ps1.
  const node = 'C:\\Program Files\\nodejs\\node.exe';
  const cli = 'C:\\Users\\Ed Smith\\.plan-pace\\src\\helper\\cli.js';
  const commandLine = `"${node}" "${cli}"`;
  const line = `shell.Run "${commandLine.replaceAll('"', '""')}", 0, True`;
  assert.equal(
    line,
    'shell.Run """C:\\Program Files\\nodejs\\node.exe"" ""C:\\Users\\Ed Smith\\.plan-pace\\src\\helper\\cli.js""", 0, True',
  );
});
