const SNAP_TTL_SEC = 12 * 60 * 60;
const AUTH_TTL_SEC = 90 * 24 * 60 * 60;
const MAX_BODY = 8192;
const MAX_CIPHER_CHARS = 6000;

const LIMITS = {
  pair: { limit: 8, windowSec: 60 },
  write: { limit: 20, windowSec: 600 },
  read: { limit: 60, windowSec: 600 },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/v1/pair') return pair(request, env);
    const match = url.pathname.match(/^\/v1\/devices\/([A-Za-z0-9_-]{16,64})$/);
    if (!match) return json({ error: 'not_found' }, 404);
    if (request.method === 'PUT') return writeSnapshot(request, env, match[1]);
    if (request.method === 'GET') return readSnapshot(request, env, match[1]);
    return json({ error: 'not_found' }, 404);
  },
};

async function pair(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (!(await allow(env.RELAY, `pair:${ip}`, LIMITS.pair))) return json({ error: 'rate_limited' }, 429);
  const deviceId = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const writeSecret = base64url(crypto.getRandomValues(new Uint8Array(32)));
  await env.RELAY.put(`auth:${deviceId}`, JSON.stringify({ secretHash: await sha256(writeSecret) }), {
    expirationTtl: AUTH_TTL_SEC,
  });
  return json({ deviceId, writeSecret }, 201);
}

async function writeSnapshot(request, env, deviceId) {
  if (!(await allow(env.RELAY, `write:${deviceId}`, LIMITS.write))) return json({ error: 'rate_limited' }, 429);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'bad_body' }, 400);
  }
  if (!validCipher(body)) return json({ error: 'bad_body' }, 400);
  const auth = await env.RELAY.get(`auth:${deviceId}`, 'json');
  const presented = bearer(request);
  if (!auth?.secretHash || !presented || !same(auth.secretHash, await sha256(presented))) {
    return json({ error: 'unauthorized' }, 401);
  }
  const updatedAt = new Date().toISOString();
  await env.RELAY.put(`snap:${deviceId}`, JSON.stringify({ v: 1, iv: body.iv, ct: body.ct, updatedAt }), {
    expirationTtl: SNAP_TTL_SEC,
  });
  await env.RELAY.put(`auth:${deviceId}`, JSON.stringify({ secretHash: auth.secretHash }), {
    expirationTtl: AUTH_TTL_SEC,
  });
  return json({ ok: true, updatedAt });
}

async function readSnapshot(request, env, deviceId) {
  if (!(await allow(env.RELAY, `read:${deviceId}`, LIMITS.read))) return json({ error: 'rate_limited' }, 429);
  const snap = await env.RELAY.get(`snap:${deviceId}`, 'json');
  if (!snap?.iv || !snap?.ct) return json({ error: 'not_found' }, 404);
  return json({ v: 1, iv: snap.iv, ct: snap.ct, updatedAt: snap.updatedAt || null });
}

function validCipher(body) {
  if (!body || body.v !== 1) return false;
  if (typeof body.iv !== 'string' || typeof body.ct !== 'string') return false;
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(body.iv)) return false;
  if (!/^[A-Za-z0-9_-]{16,6000}$/.test(body.ct) || body.ct.length > MAX_CIPHER_CHARS) return false;
  return true;
}

function bearer(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+([A-Za-z0-9_-]{20,128})$/);
  return match ? match[1] : '';
}

async function allow(kv, key, rule) {
  const slot = Math.floor(Date.now() / (rule.windowSec * 1000));
  const name = `rl:${key}:${slot}`;
  const current = Number(await kv.get(name)) || 0;
  if (current >= rule.limit) return false;
  await kv.put(name, String(current + 1), { expirationTtl: rule.windowSec + 120 });
  return true;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return base64url(new Uint8Array(digest));
}

function same(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
