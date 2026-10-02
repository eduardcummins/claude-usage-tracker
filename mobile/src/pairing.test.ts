import assert from 'node:assert/strict';
import test from 'node:test';
import { decodePairing } from './pairing.ts';
import { openJson, sealJson } from './seal.ts';

test('a pairing code from the helper shape decodes on the phone', () => {
  const keyBytes = new Uint8Array(32).fill(9);
  const key = Buffer.from(keyBytes).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ v: 1, url: 'http://127.0.0.1:8787', id: 'deviceiddeviceid12', key }),
    'utf8',
  ).toString('base64url');
  const link = decodePairing(`cluse1.${payload}`);
  assert.equal(link?.kind, 'relay');
  assert.equal(link?.url, 'http://127.0.0.1:8787');
  assert.equal(link?.deviceId, 'deviceiddeviceid12');
  assert.equal(decodePairing('cu-example'), null);
});

test('the phone can open a snapshot it sealed', () => {
  const key = Buffer.alloc(32, 4).toString('base64url');
  const snapshot = { type: 'snapshot', plan: 'Pro', windows: [] };
  const sealed = sealJson(key, snapshot);
  assert.equal(JSON.stringify(sealed).includes('Pro'), false);
  assert.deepEqual(openJson(key, sealed), snapshot);
});
