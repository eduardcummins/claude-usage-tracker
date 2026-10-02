import {
  isValidTopic,
  latestSnapshot,
  normalizeServer,
  parseNtfyLines,
  topicFromInput,
  type Snapshot,
} from './model.ts';

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
): Promise<Snapshot | null> {
  const response = await fetchImpl(pollUrl(server, topic), {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Could not read the topic (HTTP ${response.status}). ${text.slice(0, 160)}`);
  }
  return latestSnapshot(parseNtfyLines(await response.text()));
}
