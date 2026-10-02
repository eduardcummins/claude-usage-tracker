import { redact } from './redact.js';
import { parseRetryAfter } from './token-backoff.js';

export const PUBLIC_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

// Claude Code's public client. The body is the refresh grant Claude Code sends.
// A 429 stops the loop: the fallback host is only for network or server errors,
// so one rate limit is one request, not two.
const TOKEN_URLS = [
  'https://platform.claude.com/v1/oauth/token',
  'https://console.anthropic.com/v1/oauth/token',
];

const USER_AGENT = 'claude-code/2.1.80';

export async function fetchUsageResponse(accessToken, deps) {
  const response = await deps.fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, headers: response.headers, body, text };
}

export async function refreshAccessToken(refreshToken, deps) {
  let lastError = null;
  for (const url of TOKEN_URLS) {
    let response;
    try {
      response = await deps.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: PUBLIC_CLIENT_ID,
        }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      lastError = err;
      continue;
    }
    const text = await response.text();
    if (response.ok) {
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error('Claude login refresh returned something that was not JSON.');
      }
      if (!body.access_token) throw new Error('Claude login refresh did not return an access token.');
      return body;
    }
    if (response.status === 429) {
      const error = new Error(`Claude login refresh failed (429): ${redact(text).slice(0, 180)}`);
      error.code = 'refresh_rate_limited';
      error.retryAfterMs = parseRetryAfter(response.headers, currentTime(deps));
      throw error;
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      const error = new Error('Claude rejected the login refresh.');
      error.code = 'refresh_rejected';
      throw error;
    }
    lastError = new Error(`Claude login refresh failed (${response.status}): ${redact(text).slice(0, 180)}`);
  }
  throw lastError || new Error('Claude login refresh failed.');
}

function currentTime(deps) {
  if (typeof deps?.now === 'function') return deps.now();
  return deps?.now ?? Date.now();
}
