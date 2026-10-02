import type { Snapshot, UsageWindow } from './model.ts';
import type { WidgetCache } from './storage.ts';

export function widgetFromSnapshot(snapshot: Snapshot | null, connected: boolean): WidgetCache {
  const session = findWindow(snapshot?.windows, 'session');
  const weekly = findWindow(snapshot?.windows, 'weekly');
  return {
    signedIn: connected,
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
