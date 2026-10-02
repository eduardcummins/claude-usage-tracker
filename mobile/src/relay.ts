import type { Snapshot } from './model.ts';
import type { RelayLink } from './pairing.ts';
import { openJson } from './seal.ts';

export async function fetchRelaySnapshot(fetchImpl: typeof fetch, link: RelayLink): Promise<Snapshot | null> {
  const response = await fetchImpl(`${link.url}/v1/devices/${encodeURIComponent(link.deviceId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  const text = await response.text();
  if (!response.ok) throw new Error(`Could not read the relay (HTTP ${response.status}). ${text.slice(0, 160)}`);
  const body = JSON.parse(text) as { iv?: string; ct?: string };
  if (!body.iv || !body.ct) throw new Error('The relay report could not be read.');
  const snapshot = openJson(link.key, { iv: body.iv, ct: body.ct }) as Snapshot;
  if (!snapshot || snapshot.type !== 'snapshot' || !Array.isArray(snapshot.windows)) {
    throw new Error('The relay report could not be read.');
  }
  return snapshot;
}
