export const TOKEN_BACKOFF_BASE_MS = 60 * 1000;
export const TOKEN_BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;

export function tokenBackoffDelay(attempt, retryAfterMs) {
  const step = Math.min(Math.max(1, Math.floor(Number(attempt)) || 1), 16);
  const exponential = Math.min(TOKEN_BACKOFF_BASE_MS * 2 ** (step - 1), TOKEN_BACKOFF_MAX_MS);
  const server = Number(retryAfterMs);
  if (Number.isFinite(server) && server > 0) {
    return Math.min(Math.max(exponential, server), TOKEN_BACKOFF_MAX_MS);
  }
  return exponential;
}

export function parseRetryAfter(headers, now) {
  const raw = headers?.get?.('retry-after');
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const seconds = Number(text);
  if (Number.isFinite(seconds)) {
    if (seconds <= 0) return null;
    return seconds * 1000;
  }
  const when = Date.parse(text);
  if (!Number.isFinite(when)) return null;
  const delta = when - now;
  return delta > 0 ? delta : null;
}
