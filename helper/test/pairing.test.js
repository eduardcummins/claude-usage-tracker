import assert from 'node:assert/strict';
import test from 'node:test';
import { decodePairing, encodePairing } from '../lib/pairing.js';
import { defaultNtfyServer } from '../lib/server.js';

test('the pairing code carries the ntfy server, topic, and key', () => {
  const key = Buffer.alloc(32, 3).toString('base64url');
  const code = encodePairing({
    url: 'https://ntfy.sh',
    topic: 'cu-exampletopic',
    key,
  });
  assert.match(code, /^cluse1\./);
  assert.equal(code.includes(key), false);
  const decoded = decodePairing(code);
  assert.equal(decoded.url, 'https://ntfy.sh');
  assert.equal(decoded.topic, 'cu-exampletopic');
  assert.equal(decoded.key, key);
  assert.equal(decodePairing('cu-example'), null);
  assert.equal(defaultNtfyServer({}), 'https://ntfy.sh');
});
