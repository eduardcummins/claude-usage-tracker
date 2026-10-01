const assert = require('node:assert/strict');
const test = require('node:test');
const { stripApsEnvironment } = require('./without-push-entitlement');

test('the push entitlement is removed and other keys stay', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<plist version="1.0">',
    '<dict>',
    '    <key>aps-environment</key>',
    '    <string>development</string>',
    '    <key>keychain-access-groups</key>',
    '    <array/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
  const next = stripApsEnvironment(xml);
  assert.equal(next.includes('aps-environment'), false);
  assert.equal(next.includes('keychain-access-groups'), true);
  assert.equal(next.includes('<dict>'), true);
});
