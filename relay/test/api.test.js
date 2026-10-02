import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('pair, write, and read stay on /v1 and hide the plaintext', async () => {
  const mf = new Miniflare({
    modules: true,
    scriptPath: path.join(root, 'src/index.js'),
    kvNamespaces: ['RELAY'],
  });
  try {
    const origin = 'https://relay.test';
    const paired = await mf.dispatchFetch(`${origin}/v1/pair`, { method: 'POST' });
    assert.equal(paired.status, 201);
    const creds = await paired.json();
    assert.match(creds.deviceId, /^[A-Za-z0-9_-]{16,}$/);
    assert.match(creds.writeSecret, /^[A-Za-z0-9_-]{20,}$/);

    const missing = await mf.dispatchFetch(`${origin}/v1/devices/${creds.deviceId}`);
    assert.equal(missing.status, 404);

    const denied = await mf.dispatchFetch(`${origin}/v1/devices/${creds.deviceId}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer not-the-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ v: 1, iv: 'abcdefghijklmnopqr', ct: 'ciphertextciphertext' }),
    });
    assert.equal(denied.status, 401);

    const iv = 'abcdefghijklmnopqr';
    const ct = 'ciphertextvalueok';
    const stored = await mf.dispatchFetch(`${origin}/v1/devices/${creds.deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${creds.writeSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ v: 1, iv, ct }),
    });
    assert.equal(stored.status, 200);

    const read = await mf.dispatchFetch(`${origin}/v1/devices/${creds.deviceId}`);
    assert.equal(read.status, 200);
    const body = await read.json();
    assert.equal(body.iv, iv);
    assert.equal(body.ct, ct);
    assert.equal(JSON.stringify(body).includes('Pro'), false);

    const unknown = await mf.dispatchFetch(`${origin}/v1/nope`);
    assert.equal(unknown.status, 404);
  } finally {
    await mf.dispose();
  }
});

test('pairing is rate limited per address', async () => {
  const mf = new Miniflare({
    modules: true,
    scriptPath: path.join(root, 'src/index.js'),
    kvNamespaces: ['RELAY'],
  });
  try {
    let limited = 0;
    for (let i = 0; i < 10; i += 1) {
      const response = await mf.dispatchFetch('https://relay.test/v1/pair', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '203.0.113.9' },
      });
      if (response.status === 429) limited += 1;
    }
    assert.equal(limited > 0, true);
  } finally {
    await mf.dispose();
  }
});

test('a huge body is rejected', async () => {
  const mf = new Miniflare({
    modules: true,
    scriptPath: path.join(root, 'src/index.js'),
    kvNamespaces: ['RELAY'],
  });
  try {
    const paired = await (await mf.dispatchFetch('https://relay.test/v1/pair', { method: 'POST' })).json();
    const response = await mf.dispatchFetch(`https://relay.test/v1/devices/${paired.deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${paired.writeSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ v: 1, iv: 'abcdefghijklmnopqr', ct: 'a'.repeat(9000) }),
    });
    assert.equal(response.status, 413);
  } finally {
    await mf.dispose();
  }
});
