import assert from 'node:assert/strict';
import test from 'node:test';
import { decodePairing } from './pairing.ts';
import { openJson, sealJson } from './seal.ts';

test('a pairing code from the helper shape decodes on the phone', () => {
  const key = Buffer.alloc(32, 9).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ v: 1, url: 'https://ntfy.sh', topic: 'cu-exampletopic', key }),
    'utf8',
  ).toString('base64url');
  const link = decodePairing(`cluse1.${payload}`);
  assert.equal(link?.url, 'https://ntfy.sh');
  assert.equal(link?.topic, 'cu-exampletopic');
  assert.equal(link?.key, key);
  assert.equal(decodePairing('cu-example'), null);
});

test('the phone can open a snapshot it sealed', () => {
  const key = Buffer.alloc(32, 4).toString('base64url');
  const snapshot = { type: 'snapshot', plan: 'Pro', windows: [] };
  const sealed = sealJson(key, snapshot);
  assert.equal(JSON.stringify(sealed).includes('Pro'), false);
  assert.deepEqual(openJson(key, sealed), snapshot);
});
