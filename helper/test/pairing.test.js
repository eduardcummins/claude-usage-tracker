import assert from 'node:assert/strict';
import test from 'node:test';
import { decodePairing, encodePairing } from '../lib/pairing.js';

test('the pairing code carries the relay address and key, not the write secret', () => {
  const code = encodePairing({
    url: 'https://cluse-relay.example.workers.dev',
    deviceId: 'deviceiddeviceid12',
    key: Buffer.alloc(32, 3).toString('base64url'),
  });
  assert.match(code, /^cluse1\./);
  assert.equal(code.includes('write-secret'), false);
  const decoded = decodePairing(code);
  assert.equal(decoded.url, 'https://cluse-relay.example.workers.dev');
  assert.equal(decoded.deviceId, 'deviceiddeviceid12');
  assert.equal(decoded.key, Buffer.alloc(32, 3).toString('base64url'));
  assert.equal(decodePairing('cu-example'), null);
});
