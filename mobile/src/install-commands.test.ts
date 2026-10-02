import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { installCommand, MAC_INSTALL, WINDOWS_INSTALL } from './install-commands.ts';

test('the onboarding commands point at the bootstrap scripts', () => {
  assert.equal(installCommand('mac'), MAC_INSTALL);
  assert.equal(installCommand('windows'), WINDOWS_INSTALL);
  assert.match(MAC_INSTALL, /bootstrap-mac\.sh \| bash$/);
  assert.match(WINDOWS_INSTALL, /bootstrap-windows\.ps1 \| iex$/);
  assert.ok(MAC_INSTALL.length < 180);
  const mac = readFileSync(new URL('../../helper/bootstrap-mac.sh', import.meta.url), 'utf8');
  const windows = readFileSync(new URL('../../helper/bootstrap-windows.ps1', import.meta.url), 'utf8');
  assert.match(mac, /helper\/cli\.js" --init/);
  assert.match(mac, /install-mac/);
  assert.match(windows, /cli\.js" --init|--init/);
  assert.match(windows, /install-windows\.ps1/);
});
