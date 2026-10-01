import { UserError } from './errors.js';

export function assertTopic(topic) {
  if (!/^[-_A-Za-z0-9]{1,59}$/.test(String(topic || ''))) {
    throw new UserError(
      'The ntfy topic must be 1–59 characters and use only letters, numbers, hyphens, or underscores.',
    );
  }
}

export function dataTopic(topic) {
  assertTopic(topic);
  return `${topic}-data`;
}

export async function publishNtfy({ server, topic, title, message, priority, tags, token, fetch: fetchImpl }) {
  const response = await fetchImpl(server, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      topic,
      title,
      message,
      priority,
      tags,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new UserError(`ntfy rejected the message (${response.status}). ${text.slice(0, 180)}`);
  }
}
