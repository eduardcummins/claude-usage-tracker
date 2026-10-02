const assert = require('node:assert/strict');
const test = require('node:test');
const { stripMicrophoneUsage } = require('./without-microphone');

test('the microphone purpose string is removed and the camera purpose stays', () => {
  const xml = [
    '<dict>',
    '  <key>NSCameraUsageDescription</key>',
    '  <string>Scan the topic code</string>',
    '  <key>NSMicrophoneUsageDescription</key>',
    '  <string>Allow the app to access your microphone</string>',
    '</dict>',
  ].join('\n');
  const next = stripMicrophoneUsage(xml);
  assert.equal(next.includes('NSMicrophoneUsageDescription'), false);
  assert.equal(next.includes('NSCameraUsageDescription'), true);
  assert.equal(next.includes('Scan the topic code'), true);
});
