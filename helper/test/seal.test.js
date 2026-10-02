import assert from 'node:assert/strict';
import test from 'node:test';
import { openJson, sealJson } from '../lib/seal.js';

test('a snapshot seals and opens with the same key', () => {
  const key = Buffer.alloc(32, 7).toString('base64url');
  const snapshot = { type: 'snapshot', plan: 'Pro', windows: [] };
  const sealed = sealJson(key, snapshot);
  assert.equal(sealed.v, 1);
  assert.equal(JSON.stringify(sealed).includes('Pro'), false);
  assert.deepEqual(openJson(key, sealed), snapshot);
});

test('a different key cannot open the snapshot', () => {
  const key = Buffer.alloc(32, 7).toString('base64url');
  const other = Buffer.alloc(32, 8).toString('base64url');
  const sealed = sealJson(key, { type: 'snapshot' });
  assert.throws(() => openJson(other, sealed));
});
