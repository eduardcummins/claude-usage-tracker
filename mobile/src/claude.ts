export const PUBLIC_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
export const AUTHORIZE_URL = 'https://claude.com/cai/oauth/authorize';
export const REDIRECT_URI = 'https://platform.claude.com/oauth/code/callback';
export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
export const TOKEN_URLS = [
  'https://platform.claude.com/v1/oauth/token',
  'https://console.anthropic.com/v1/oauth/token',
];
export const SCOPES = [
  'user:profile',
  'user:inference',
  'user:sessions:claude_code',
  'user:mcp_servers',
  'user:file_upload',
];

const ATTEMPT_MS = 10 * 60 * 1000;
const USER_AGENT = 'claude-code/2.1.80';

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type LoginAttempt = {
  verifier: string;
  state: string;
  createdAt: number;
};

export class SignInRejected extends Error {
  readonly code = 'rejected';
}

export function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

export function codeChallengeFromDigest(digest: Uint8Array): string {
  return base64Url(digest);
}

export function buildAuthorizeUrl(input: { challenge: string; state: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('code', 'true');
  url.searchParams.set('client_id', PUBLIC_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('code_challenge', input.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', input.state);
  return url.toString();
}

export function assertAttemptFresh(createdAt: number, now: number): void {
  if (!Number.isFinite(createdAt) || now - createdAt > ATTEMPT_MS) {
    throw new Error('That sign-in expired. Open the sign-in page again.');
  }
}

export function parseAuthorizationPaste(input: string, expectedState: string): { code: string } {
  let text = input.trim();
  if (/^https?:\/\//i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new Error('Paste the code from the sign-in page.');
    }
    const state = url.searchParams.get('state');
    if (state && state !== expectedState) {
      throw new Error('That code is from a different sign-in. Open the sign-in page again.');
    }
    text = url.searchParams.get('code') || '';
  }
  const hash = text.indexOf('#');
  if (hash >= 0) {
    const state = text.slice(hash + 1).trim();
    text = text.slice(0, hash).trim();
    if (state && state !== expectedState) {
      throw new Error('That code is from a different sign-in. Open the sign-in page again.');
    }
  }
  text = text.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9._~-]{8,256}$/.test(text)) {
    throw new Error('Paste the code from the sign-in page. It is a long string of letters and numbers.');
  }
  return { code: text };
}

export function usageHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'anthropic-beta': 'oauth-2025-04-20',
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  };
}

export function refreshFields(refreshToken: string): Record<string, string> {
  return {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: PUBLIC_CLIENT_ID,
  };
}

export function authorizationFields(code: string, attempt: LoginAttempt): Record<string, string> {
  return {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: PUBLIC_CLIENT_ID,
    code_verifier: attempt.verifier,
    state: attempt.state,
  };
}

export function sessionFromToken(body: unknown, previous: Session | null, now: number): Session {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const accessToken = typeof record.access_token === 'string' ? record.access_token : '';
  if (!accessToken) throw new Error('Claude did not return a login.');
  const refreshToken =
    typeof record.refresh_token === 'string' && record.refresh_token
      ? record.refresh_token
      : previous?.refreshToken || '';
  if (!refreshToken) throw new Error('Claude did not return a login that can be renewed.');
  const expiresIn = Number(record.expires_in);
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? now + expiresIn * 1000 : now + 60 * 60 * 1000;
  return { accessToken, refreshToken, expiresAt };
}

export function tokenStillValid(expiresAt: number, now: number, skewMs = 120000): boolean {
  return expiresAt - now > skewMs;
}

export function redact(value: string): string {
  return value.replace(/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 180);
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function requestToken(fetchImpl: FetchLike, fields: Record<string, string>): Promise<unknown> {
  let lastError = 'Claude did not accept the login.';
  for (const url of TOKEN_URLS) {
    const jsonResult = await sendToken(fetchImpl, url, fields, 'json');
    if (jsonResult.ok) return jsonResult.body;
    if (jsonResult.status === 400 || jsonResult.status === 415) {
      const formResult = await sendToken(fetchImpl, url, fields, 'form');
      if (formResult.ok) return formResult.body;
      if (isRejection(formResult.status)) throw new SignInRejected('Claude rejected the login. Sign in again.');
      lastError = formResult.message;
      continue;
    }
    if (isRejection(jsonResult.status)) throw new SignInRejected('Claude rejected the login. Sign in again.');
    lastError = jsonResult.message;
  }
  throw new Error(lastError);
}

function isRejection(status: number): boolean {
  return status === 400 || status === 401 || status === 403;
}

async function sendToken(
  fetchImpl: FetchLike,
  url: string,
  fields: Record<string, string>,
  kind: 'json' | 'form',
): Promise<{ ok: true; body: unknown } | { ok: false; status: number; message: string }> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': kind === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: kind === 'json' ? JSON.stringify(fields) : new URLSearchParams(fields).toString(),
    });
  } catch {
    return { ok: false, status: 0, message: 'The phone could not reach Claude. Check the connection and try again.' };
  }
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, message: `Claude did not accept the login (${response.status}).` };
  }
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: response.status, message: 'Claude returned a login the app could not read.' };
  }
}

export async function requestUsage(
  fetchImpl: FetchLike,
  accessToken: string,
): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    response = await fetchImpl(USAGE_URL, { headers: usageHeaders(accessToken) });
  } catch {
    throw new Error('The phone could not reach Claude. Check the connection and try again.');
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, body };
}
