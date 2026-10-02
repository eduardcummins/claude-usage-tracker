import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UserError } from './errors.js';
import { sealJson } from './seal.js';

export function relayBaseUrl(env = process.env) {
  const fromEnv = String(env.CLUSE_RELAY_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../relay/public.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return String(parsed.url || '').replace(/\/$/, '');
}

export async function pairRelay(fetchImpl, url) {
  const response = await fetchImpl(`${url}/v1/pair`, { method: 'POST' });
  if (!response.ok) return null;
  const body = JSON.parse(await response.text());
  if (!body?.deviceId || !body?.writeSecret) return null;
  return { deviceId: String(body.deviceId), writeSecret: String(body.writeSecret) };
}

export async function publishRelay({ url, deviceId, writeSecret, key, snapshot, fetch: fetchImpl }) {
  const sealed = sealJson(key, snapshot);
  const response = await fetchImpl(`${url.replace(/\/$/, '')}/v1/devices/${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${writeSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sealed),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new UserError(`The relay rejected the update (${response.status}). ${text.slice(0, 160)}`);
  }
}
