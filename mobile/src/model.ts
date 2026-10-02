export type UsageWindow = {
  id: string;
  label: string;
  shortLabel: string;
  usedPercent: number;
  resetsAt: string | null;
  severity: string | null;
};

export type HistoryPoint = {
  t: string;
  w: Record<string, number>;
};

export type Snapshot = {
  v: number;
  type: 'snapshot';
  fetchedAt: string;
  plan: string | null;
  timeZone: string;
  windows: UsageWindow[];
  extraUsageLabel: string | null;
  recent: HistoryPoint[];
  status?: string;
  notice?: string;
  checkedAt?: string;
};

export const OPEN_CLAUDE_CODE_NOTE = 'Open Claude Code on your computer to refresh';
export const SINCE_RESET_NOTE = 'since reset';

export type PresentedWindow = UsageWindow & {
  displayPercent: number;
  sinceReset: boolean;
  sinceResetNote: string | null;
};

export type NtfyMessage = {
  id: string;
  time: number;
  title: string;
  message: string;
  tags: string[];
  topic: string;
};

export function topicFromInput(value: string): string {
  let text = value.trim();
  if (/^https?:\/\//i.test(text)) {
    try {
      const parts = new URL(text).pathname.split('/').filter(Boolean);
      text = parts[parts.length - 1] || '';
    } catch {
      // Keep the typed text when it is not a URL.
    }
  }
  if (text.endsWith('-data')) text = text.slice(0, -'-data'.length);
  return text;
}

export function isValidTopic(topic: string): boolean {
  return /^[-_A-Za-z0-9]{1,59}$/.test(topic);
}

export function normalizeServer(value: string): string {
  const text = value.trim().replace(/\/$/, '');
  return text || 'https://ntfy.sh';
}

export function parseNtfyLines(text: string): NtfyMessage[] {
  const messages: NtfyMessage[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (event.event !== 'message') continue;
    const tags = Array.isArray(event.tags) ? event.tags.map((tag) => String(tag)) : [];
    messages.push({
      id: String(event.id || ''),
      time: Number(event.time) || 0,
      title: String(event.title || ''),
      message: String(event.message || ''),
      tags,
      topic: String(event.topic || ''),
    });
  }
  return messages;
}

export function snapshotFromMessage(message: string): Snapshot | null {
  try {
    const data = JSON.parse(message) as Snapshot;
    if (!data || data.type !== 'snapshot' || !Array.isArray(data.windows)) return null;
    return data;
  } catch {
    return null;
  }
}

export function latestSnapshot(messages: NtfyMessage[]): Snapshot | null {
  let best: Snapshot | null = null;
  let bestMs = -1;
  for (const message of messages) {
    const snapshot = snapshotFromMessage(message.message);
    if (!snapshot) continue;
    const ms = snapshotRecency(snapshot);
    if (!Number.isFinite(ms) || ms < bestMs) continue;
    best = snapshot;
    bestMs = ms;
  }
  return best;
}

export function latestAlert(messages: NtfyMessage[]): NtfyMessage | null {
  let best: NtfyMessage | null = null;
  for (const message of messages) {
    const interesting = message.tags.includes('reset') || message.tags.includes('test');
    if (!interesting) continue;
    if (!best || message.time >= best.time) best = message;
  }
  return best;
}

export function snapshotRecency(snapshot: { fetchedAt: string; checkedAt?: string }): number {
  const checked = snapshot.checkedAt ? Date.parse(snapshot.checkedAt) : NaN;
  if (Number.isFinite(checked)) return checked;
  const fetched = Date.parse(snapshot.fetchedAt);
  return Number.isFinite(fetched) ? fetched : NaN;
}

export function presentSnapshot(snapshot: Snapshot, now: number): {
  waitingNote: string | null;
  windows: PresentedWindow[];
} {
  return {
    waitingNote: snapshot.status === 'waiting-login' ? OPEN_CLAUDE_CODE_NOTE : null,
    windows: snapshot.windows.map((window) => presentWindow(window, now)),
  };
}

export function presentWindow(window: UsageWindow, now: number): PresentedWindow {
  const shown = presentPercent(window.usedPercent, window.resetsAt, now);
  return {
    ...window,
    displayPercent: shown.percent ?? 0,
    sinceReset: shown.sinceReset,
    sinceResetNote: shown.sinceReset ? SINCE_RESET_NOTE : null,
  };
}

export function presentPercent(
  percent: number | null,
  resetsAt: string | null,
  now: number,
): { percent: number | null; sinceReset: boolean } {
  if (percent == null) return { percent: null, sinceReset: false };
  const resetMs = resetsAt ? Date.parse(resetsAt) : NaN;
  if (Number.isFinite(resetMs) && resetMs <= now) return { percent: 0, sinceReset: true };
  return { percent, sinceReset: false };
}

export function resetCaption(resetsAt: string | null, now: number): string {
  if (!resetsAt) return 'No report yet';
  const remaining = formatRemaining(resetsAt, now);
  return Date.parse(resetsAt) <= now ? `${remaining} · since reset` : remaining;
}

export function formatWhen(iso: string, timeZone = 'Europe/London'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const zone = safeZone(timeZone);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function formatRemaining(iso: string, now: number): string {
  const ms = Date.parse(iso) - now;
  if (!Number.isFinite(ms)) return 'reset time unknown';
  if (ms <= 0) return `reset ${formatDuration(-ms)} ago`;
  return `resets in ${formatDuration(ms)}`;
}

export function formatAge(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 45000) return 'just now';
  return `${formatDuration(ms)} ago`;
}

export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return 'less than a minute';
  const days = Math.floor(mins / (60 * 24));
  const hours = Math.floor((mins % (60 * 24)) / 60);
  const minutes = mins % 60;
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function zoneLabel(timeZone?: string | null): string {
  return !timeZone || safeZone(timeZone) === 'Europe/London' ? 'UK time' : safeZone(timeZone);
}

export function barColor(percent: number): string {
  if (percent >= 90) return '#9b2c2c';
  if (percent >= 70) return '#8a5a00';
  return '#0f6e56';
}

export function sampleSnapshot(now = Date.now()): Snapshot {
  const sessionReset = new Date(now + (2 * 60 + 14) * 60000).toISOString();
  const weeklyReset = new Date(now + 3 * 24 * 60 * 60000).toISOString();
  const fetchedAt = new Date(now - 2 * 60000).toISOString();
  return {
    v: 1,
    type: 'snapshot',
    fetchedAt,
    plan: 'Sample',
    timeZone: 'Europe/London',
    extraUsageLabel: null,
    windows: [
      {
        id: 'session',
        label: '5-hour session',
        shortLabel: '5h',
        usedPercent: 64,
        resetsAt: sessionReset,
        severity: null,
      },
      {
        id: 'weekly',
        label: 'Weekly (all models)',
        shortLabel: 'Week',
        usedPercent: 22,
        resetsAt: weeklyReset,
        severity: null,
      },
    ],
    recent: [
      { t: new Date(now - 40 * 60000).toISOString(), w: { session: 51, weekly: 21 } },
      { t: new Date(now - 20 * 60000).toISOString(), w: { session: 58, weekly: 22 } },
      { t: fetchedAt, w: { session: 64, weekly: 22 } },
    ],
  };
}

export function sampleReset(snapshot: Snapshot, now = Date.now()): Snapshot {
  const nextReset = new Date(now + 5 * 60 * 60000).toISOString();
  return {
    ...snapshot,
    fetchedAt: new Date(now).toISOString(),
    windows: snapshot.windows.map((window) =>
      window.id === 'session' ? { ...window, usedPercent: 3, resetsAt: nextReset } : window,
    ),
    recent: [
      ...snapshot.recent,
      { t: new Date(now).toISOString(), w: { session: 3, weekly: 22 } },
    ],
  };
}

function safeZone(timeZone: string): string {
  try {
    Intl.DateTimeFormat('en-GB', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'Europe/London';
  }
}
