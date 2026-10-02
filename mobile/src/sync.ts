import {
  authorizationFields,
  redact,
  refreshFields,
  formatStageFailure,
  requestToken,
  requestUsage,
  sessionFromToken,
  SignInRejected,
  tokenStillValid,
} from './claude.ts';
import type { LoginAttempt, Session } from './claude.ts';
import type { UsageWindow } from './model.ts';
import { parseUsageResponse, planAlarms, resetNotification } from './usage.ts';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type SyncInput = {
  fetch: FetchLike;
  now: number;
  session: Session | null;
  previousWindows: UsageWindow[] | null;
  scheduled: Record<string, string>;
};

export type SyncResult = {
  session: Session | null;
  signedOut: boolean;
  windows: UsageWindow[] | null;
  extraUsageLabel: string | null;
  error: string | null;
  notify: { title: string; body: string } | null;
  scheduled: Record<string, string>;
};

export async function syncUsage(input: SyncInput): Promise<SyncResult> {
  if (!input.session) {
    return empty(input.scheduled, true, null);
  }
  let session = input.session;
  try {
    session = await ensureFresh(input.fetch, session, input.now);
  } catch (err) {
    if (err instanceof SignInRejected) return empty(input.scheduled, true, err.message);
    return { ...empty(input.scheduled, false, message(err)), session };
  }

  let usage = await readUsage(input.fetch, session.accessToken);
  if (usage.error) return { ...empty(input.scheduled, false, usage.error), session };
  if (usage.status === 401) {
    try {
      session = await refresh(input.fetch, session, input.now);
      usage = await readUsage(input.fetch, session.accessToken);
    } catch (err) {
      if (err instanceof SignInRejected) return empty(input.scheduled, true, err.message);
      return { ...empty(input.scheduled, false, message(err)), session };
    }
    if (usage.error) return { ...empty(input.scheduled, false, usage.error), session };
  }
  if (usage.status === 429) {
    return { ...empty(input.scheduled, false, 'Claude asked the app to slow down. The last numbers stay on screen.'), session };
  }
  if (usage.status !== 200 || usage.body == null) {
    return {
      ...empty(input.scheduled, false, formatStageFailure('Usage check', usage.status, usage.detail)),
      session,
    };
  }

  let parsed: ReturnType<typeof parseUsageResponse>;
  try {
    parsed = parseUsageResponse(usage.body);
  } catch (err) {
    return { ...empty(input.scheduled, false, message(err)), session };
  }
  const alarms = planAlarms({
    previous: input.previousWindows,
    next: parsed.windows,
    scheduled: input.scheduled,
    now: input.now,
  });
  return {
    session,
    signedOut: false,
    windows: parsed.windows,
    extraUsageLabel: parsed.extraUsageLabel,
    error: null,
    notify: alarms.notify.length ? resetNotification(alarms.notify) : null,
    scheduled: alarms.scheduled,
  };
}

export async function exchangeCode(fetchImpl: FetchLike, code: string, attempt: LoginAttempt, now: number): Promise<Session> {
  const body = await requestToken(fetchImpl, authorizationFields(code, attempt));
  return sessionFromToken(body, null, now);
}

async function ensureFresh(fetchImpl: FetchLike, session: Session, now: number): Promise<Session> {
  if (tokenStillValid(session.expiresAt, now)) return session;
  return refresh(fetchImpl, session, now);
}

async function refresh(fetchImpl: FetchLike, session: Session, now: number): Promise<Session> {
  const body = await requestToken(fetchImpl, refreshFields(session.refreshToken));
  return sessionFromToken(body, session, now);
}

async function readUsage(
  fetchImpl: FetchLike,
  accessToken: string,
): Promise<{ status: number; body: unknown; detail: string; error?: string }> {
  try {
    return await requestUsage(fetchImpl, accessToken);
  } catch (err) {
    return { status: 0, body: null, detail: '', error: message(err) };
  }
}

function empty(scheduled: Record<string, string>, signedOut: boolean, error: string | null): SyncResult {
  return {
    session: null,
    signedOut,
    windows: null,
    extraUsageLabel: null,
    error,
    notify: null,
    scheduled,
  };
}

function message(err: unknown): string {
  if (err instanceof Error) return redact(err.message);
  return 'Something went wrong.';
}
