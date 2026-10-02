import {
  isValidTopic,
  latestSnapshot,
  normalizeServer,
  parseNtfyLines,
  topicFromInput,
  type NtfyMessage,
  type Snapshot,
} from './model.ts';
import { openJson } from './seal.ts';

/** ntfy.sh keeps a cached message for about 12 hours. */
export const NTFY_CACHE_WINDOW = '12h';

export function dataTopic(topic: string): string {
  if (!isValidTopic(topic)) {
    throw new Error('Paste the topic from the computer. It uses letters, numbers, hyphens, or underscores.');
  }
  return `${topic}-data`;
}

export function settingsFromInput(value: string): { topic: string; server: string } {
  let server = 'https://ntfy.sh';
  const text = value.trim();
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      server = `${url.protocol}//${url.host}`;
    } catch {
      // topicFromInput still extracts whatever was typed.
    }
  }
  return { topic: topicFromInput(text), server: normalizeServer(server) };
}

export function pollUrl(server: string, topic: string, since = NTFY_CACHE_WINDOW): string {
  const base = normalizeServer(server);
  const name = encodeURIComponent(dataTopic(topic));
  return `${base}/${name}/json?poll=1&since=${encodeURIComponent(since)}`;
}

export async function fetchLatestSnapshot(
  fetchImpl: typeof fetch,
  server: string,
  topic: string,
  key = '',
): Promise<Snapshot | null> {
  const response = await fetchImpl(pollUrl(server, topic), {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Could not read the topic (HTTP ${response.status}). ${text.slice(0, 160)}`);
  }
  return snapshotFromPoll(parseNtfyLines(await response.text()), key);
}

export function snapshotFromPoll(messages: NtfyMessage[], key = ''): Snapshot | null {
  if (!key) return latestSnapshot(messages);
  let best: Snapshot | null = null;
  let bestMs = -1;
  let sealed = false;
  for (const message of messages) {
    const snapshot = decryptSnapshot(message.message, key);
    if (snapshot === undefined) continue;
    if (snapshot === null) {
      sealed = true;
      continue;
    }
    const ms = Date.parse(snapshot.fetchedAt);
    if (!Number.isFinite(ms) || ms < bestMs) continue;
    best = snapshot;
    bestMs = ms;
  }
  if (!best && sealed) throw new Error('Could not decrypt the report. Paste the pairing code again.');
  return best;
}

function decryptSnapshot(message: string, key: string): Snapshot | null | undefined {
  let sealed: { iv?: string; ct?: string };
  try {
    sealed = JSON.parse(message) as { iv?: string; ct?: string };
  } catch {
    return undefined;
  }
  if (!sealed?.iv || !sealed?.ct) return undefined;
  try {
    const data = openJson(key, { iv: sealed.iv, ct: sealed.ct }) as Snapshot;
    if (!data || data.type !== 'snapshot' || !Array.isArray(data.windows)) return null;
    return data;
  } catch {
    return null;
  }
}
