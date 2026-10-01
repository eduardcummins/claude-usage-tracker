import { cancelResetAlarms, notifyLocal, syncResetAlarms } from './alerts';
import { stopBackground } from './register-background';
import { assertAttemptFresh, parseAuthorizationPaste } from './claude';
import type { Snapshot, UsageWindow } from './model';
import {
  clearLoginAttempt,
  clearSession,
  loadLoginAttempt,
  loadSession,
  saveSession,
} from './secure-session';
import { exchangeCode, syncUsage } from './sync';
import {
  WidgetCache,
  clearPlanData,
  emptyWidget,
  loadHistory,
  loadScheduled,
  loadSnapshot,
  loadWidgetCache,
  loadWindows,
  saveHistory,
  saveScheduled,
  saveSnapshot,
  saveWidgetCache,
  saveWindows,
} from './storage';
import { buildSnapshot } from './usage';
import { pushWidget } from './widget-update';

export type SyncOutcome = {
  snapshot: Snapshot | null;
  error: string | null;
  signedOut: boolean;
  widget: WidgetCache;
};

let inflight: Promise<SyncOutcome> | null = null;

export function runSync(updateWidget = true): Promise<SyncOutcome> {
  if (inflight) return inflight;
  inflight = runSyncOnce(updateWidget).finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function finishSignIn(paste: string): Promise<void> {
  const attempt = await loadLoginAttempt();
  if (!attempt) throw new Error('Open the sign-in page again.');
  const now = Date.now();
  assertAttemptFresh(attempt.createdAt, now);
  const { code } = parseAuthorizationPaste(paste, attempt.state);
  const session = await exchangeCode(fetch, code, attempt, now);
  await saveSession(session);
  await clearLoginAttempt();
}

async function runSyncOnce(updateWidget: boolean): Promise<SyncOutcome> {
  const [session, previousWindows, scheduled, history, saved] = await Promise.all([
    loadSession(),
    loadWindows(),
    loadScheduled(),
    loadHistory(),
    loadSnapshot(),
  ]);
  if (!session) {
    return finish(emptyWidget, null, null, true, updateWidget);
  }
  const now = Date.now();
  const result = await syncUsage({
    fetch,
    now,
    session,
    previousWindows,
    scheduled,
  });
  if (result.signedOut) {
    await clearSession();
    return finish(emptyWidget, null, result.error, true, updateWidget);
  }
  if (result.session) await saveSession(result.session);
  await saveScheduled(result.scheduled);
  if (!result.windows) {
    const widget = widgetFrom(saved, true);
    return finish(widget, saved, result.error, false, updateWidget);
  }
  const built = buildSnapshot({
    fetchedAt: new Date(now).toISOString(),
    plan: null,
    timeZone: deviceZone(),
    windows: result.windows,
    extraUsageLabel: result.extraUsageLabel,
    history,
  });
  await Promise.all([
    saveHistory(built.history),
    saveWindows(result.windows),
    saveSnapshot(built.snapshot),
  ]);
  await syncResetAlarms(result.windows);
  if (result.notify) await notifyLocal(result.notify.title, result.notify.body);
  return finish(widgetFrom(built.snapshot, true), built.snapshot, result.error, false, updateWidget);
}

async function finish(
  widget: WidgetCache,
  snapshot: Snapshot | null,
  error: string | null,
  signedOut: boolean,
  updateWidget: boolean,
): Promise<SyncOutcome> {
  await saveWidgetCache(widget);
  if (updateWidget) await pushWidget(widget);
  return { snapshot, error, signedOut, widget };
}

function widgetFrom(snapshot: Snapshot | null, signedIn: boolean): WidgetCache {
  const session = findWindow(snapshot?.windows, 'session');
  const weekly = findWindow(snapshot?.windows, 'weekly');
  return {
    signedIn,
    plan: snapshot?.plan ?? null,
    sessionPercent: session?.usedPercent ?? null,
    sessionReset: session?.resetsAt ?? null,
    weeklyPercent: weekly?.usedPercent ?? null,
    weeklyReset: weekly?.resetsAt ?? null,
    fetchedAt: snapshot?.fetchedAt ?? null,
  };
}

function findWindow(windows: UsageWindow[] | undefined, id: string): UsageWindow | undefined {
  return windows?.find((window) => window.id === id);
}

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
  } catch {
    return 'Europe/London';
  }
}

export async function signOut(): Promise<void> {
  await stopBackground();
  await cancelResetAlarms();
  await clearSession();
  await clearPlanData();
  await saveWidgetCache(emptyWidget);
  await pushWidget(emptyWidget);
}

export async function cachedWidget(): Promise<WidgetCache> {
  return loadWidgetCache();
}
