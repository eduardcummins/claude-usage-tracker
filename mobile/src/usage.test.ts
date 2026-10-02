import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { exchangeCode, syncUsage } from './sync.ts';
import { detectResetWindows, parseUsageResponse, planAlarms } from './usage.ts';

const now = Date.parse('2026-10-01T12:00:00Z');

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../helper/fixtures/${name}`, import.meta.url), 'utf8'));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('the current usage payload becomes the 5-hour and weekly windows', () => {
  const parsed = parseUsageResponse(fixture('usage-fable.json'));
  assert.deepEqual(
    parsed.windows.map((window) => [window.id, window.usedPercent, window.resetsAt]),
    [
      ['session', 12, '2026-10-01T17:00:00.000Z'],
      ['weekly', 9, '2026-10-05T16:00:00.000Z'],
      ['weekly:Fable', 41, '2026-10-05T16:00:00.000Z'],
    ],
  );
});

test('the older named usage fields still parse', () => {
  const parsed = parseUsageResponse(fixture('usage-legacy.json'));
  assert.equal(parsed.windows[0].id, 'session');
  assert.equal(parsed.windows[1].id, 'weekly');
});

test('a later reset time is a new window', () => {
  const previous = [{ id: 'session', label: '5-hour session', shortLabel: '5h', usedPercent: 90, resetsAt: '2026-10-01T13:00:00.000Z', severity: null }];
  const next = [{ ...previous[0], usedPercent: 4, resetsAt: '2026-10-01T18:00:00.000Z' }];
  assert.equal(detectResetWindows(previous, next).length, 1);
  assert.equal(detectResetWindows(null, next).length, 0);
  assert.equal(detectResetWindows(previous, previous).length, 0);
});

test('a reset notifies only when this phone had not already set an alarm', () => {
  const previous = [{ id: 'session', label: '5-hour session', shortLabel: '5h', usedPercent: 90, resetsAt: '2026-10-01T13:00:00.000Z', severity: null }];
  const next = [{ ...previous[0], usedPercent: 4, resetsAt: '2026-10-01T18:00:00.000Z' }];
  const missed = planAlarms({ previous, next, scheduled: {}, now });
  assert.equal(missed.notify.length, 1);
  assert.equal(missed.scheduled.session, next[0].resetsAt);
  const already = planAlarms({ previous, next, scheduled: { session: previous[0].resetsAt }, now });
  assert.equal(already.notify.length, 0);
});

test('a valid login reads usage without refreshing', async () => {
  const calls: string[] = [];
  const fetchImpl = async (url: string) => {
    calls.push(url);
    return json(fixture('usage-fable.json'));
  };
  const result = await syncUsage({
    fetch: fetchImpl as typeof fetch,
    now,
    session: { accessToken: 'access', refreshToken: 'refresh', expiresAt: now + 60 * 60 * 1000 },
    previousWindows: null,
    scheduled: {},
  });
  assert.deepEqual(calls, ['https://api.anthropic.com/api/oauth/usage']);
  assert.equal(result.windows?.[0].usedPercent, 12);
  assert.equal(result.notify, null);
  assert.equal(result.signedOut, false);
});

test('an expired login is refreshed before usage is read', async () => {
  const urls: string[] = [];
  const fetchImpl = async (url: string) => {
    urls.push(url);
    if (url.includes('/oauth/token')) {
      return json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 });
    }
    return json(fixture('usage-after.json'));
  };
  const result = await syncUsage({
    fetch: fetchImpl as typeof fetch,
    now,
    session: { accessToken: 'old', refreshToken: 'refresh', expiresAt: now },
    previousWindows: null,
    scheduled: {},
  });
  assert.deepEqual(urls.map((url) => (url.includes('/oauth/token') ? 'token' : 'usage')), ['token', 'usage']);
  assert.equal(result.session?.accessToken, 'new-access');
  assert.equal(result.session?.refreshToken, 'new-refresh');
  assert.equal(result.windows?.[0].usedPercent, 4);
});

test('a rejected usage call refreshes once and tries again', async () => {
  let usageCalls = 0;
  const fetchImpl = async (url: string) => {
    if (url.includes('/oauth/token')) {
      return json({ access_token: 'new-access', expires_in: 3600 });
    }
    usageCalls += 1;
    if (usageCalls === 1) return json({ error: 'unauthorized' }, 401);
    return json(fixture('usage-after.json'));
  };
  const result = await syncUsage({
    fetch: fetchImpl as typeof fetch,
    now,
    session: { accessToken: 'access', refreshToken: 'refresh', expiresAt: now + 60 * 60 * 1000 },
    previousWindows: null,
    scheduled: {},
  });
  assert.equal(usageCalls, 2);
  assert.equal(result.session?.accessToken, 'new-access');
  assert.equal(result.session?.refreshToken, 'refresh');
  assert.equal(result.windows?.[0].usedPercent, 4);
});

test('a failed usage read names the stage and HTTP status', async () => {
  const fetchImpl = async () => json({ error: 'forbidden', error_description: 'sk-ant-oat01-SECRET' }, 403);
  const result = await syncUsage({
    fetch: fetchImpl as typeof fetch,
    now,
    session: { accessToken: 'access', refreshToken: 'refresh', expiresAt: now + 60 * 60 * 1000 },
    previousWindows: null,
    scheduled: {},
  });
  assert.equal(result.signedOut, false);
  assert.match(result.error || '', /Usage check failed \(HTTP 403\): forbidden: \[redacted\]/);
  assert.equal((result.error || '').includes('SECRET'), false);
});

test('a rejected refresh signs the phone out', async () => {
  const fetchImpl = async () => json({ error: 'invalid_grant' }, 400);
  const result = await syncUsage({
    fetch: fetchImpl as typeof fetch,
    now,
    session: { accessToken: 'old', refreshToken: 'refresh', expiresAt: now },
    previousWindows: null,
    scheduled: { session: '2026-10-01T13:00:00.000Z' },
  });
  assert.equal(result.signedOut, true);
  assert.equal(result.session, null);
  assert.match(result.error || '', /Sign in again/);
});

test('a pasted authorization code becomes a stored session', async () => {
  const fetchImpl = async () => json({ access_token: 'access', refresh_token: 'refresh', expires_in: 10 });
  const session = await exchangeCode(
    fetchImpl as typeof fetch,
    'abc12345',
    { verifier: 'verifier', state: 'state', createdAt: now },
    now,
  );
  assert.equal(session.accessToken, 'access');
  assert.equal(session.expiresAt, now + 10_000);
});
