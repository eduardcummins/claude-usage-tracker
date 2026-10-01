import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  AUTHORIZE_URL,
  PUBLIC_CLIENT_ID,
  REDIRECT_URI,
  assertAttemptFresh,
  authorizationFields,
  base64Url,
  buildAuthorizeUrl,
  codeChallengeFromDigest,
  parseAuthorizationPaste,
  redact,
  refreshFields,
  requestToken,
  sessionFromToken,
  usageHeaders,
} from './claude.ts';

test('the sign-in URL uses Claude Code’s public client and the manual redirect', () => {
  const url = new URL(buildAuthorizeUrl({ challenge: 'challenge-value', state: 'state-value' }));
  assert.equal(url.origin + url.pathname, AUTHORIZE_URL);
  assert.equal(url.searchParams.get('client_id'), PUBLIC_CLIENT_ID);
  assert.equal(url.searchParams.get('redirect_uri'), REDIRECT_URI);
  assert.equal(url.searchParams.get('code_challenge'), 'challenge-value');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), 'state-value');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.match(url.searchParams.get('scope') || '', /user:inference/);
});

test('a PKCE challenge is the base64url SHA-256 of the verifier', () => {
  const verifier = base64Url(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
  const digest = createHash('sha256').update(verifier).digest();
  assert.equal(codeChallengeFromDigest(new Uint8Array(digest)), createHash('sha256').update(verifier).digest('base64url'));
});

test('a pasted code keeps the part before the hash and checks state', () => {
  assert.deepEqual(parseAuthorizationPaste('abc12345#state-value', 'state-value'), { code: 'abc12345' });
  assert.throws(() => parseAuthorizationPaste('abc12345#other', 'state-value'), /different sign-in/);
  const link = `https://platform.claude.com/oauth/code/callback?code=from-link1&state=state-value`;
  assert.deepEqual(parseAuthorizationPaste(link, 'state-value'), { code: 'from-link1' });
});

test('an old sign-in attempt is refused', () => {
  assert.throws(() => assertAttemptFresh(1_000, 1_000 + 11 * 60 * 1000), /expired/);
  assert.doesNotThrow(() => assertAttemptFresh(1_000, 1_000 + 60 * 1000));
});

test('usage and refresh requests match the helper and hide tokens in errors', () => {
  const headers = usageHeaders('sk-ant-oat01-secret');
  assert.equal(headers.Authorization, 'Bearer sk-ant-oat01-secret');
  assert.equal(headers['anthropic-beta'], 'oauth-2025-04-20');
  assert.equal(refreshFields('sk-ant-ort01-secret').grant_type, 'refresh_token');
  assert.equal(authorizationFields('code', { verifier: 'v', state: 's', createdAt: 1 }).grant_type, 'authorization_code');
  assert.equal(redact('failed sk-ant-oat01-secret today'), 'failed [redacted] today');
});

test('a JSON rejection falls back to a form body and keeps the refresh token', async () => {
  const bodies: string[] = [];
  const fetchImpl = async (_url: string, init?: RequestInit) => {
    bodies.push(String(init?.body));
    if (bodies.length === 1) {
      return new Response('no', { status: 400 });
    }
    return new Response(JSON.stringify({ access_token: 'next-access', expires_in: 100 }), { status: 200 });
  };
  const body = await requestToken(fetchImpl as typeof fetch, refreshFields('refresh-1'));
  const session = sessionFromToken(body, { accessToken: 'old', refreshToken: 'refresh-1', expiresAt: 1 }, 5_000);
  assert.equal(session.accessToken, 'next-access');
  assert.equal(session.refreshToken, 'refresh-1');
  assert.equal(session.expiresAt, 5_000 + 100_000);
  assert.match(bodies[0], /refresh_token/);
  assert.match(bodies[1], /grant_type=refresh_token/);
});
