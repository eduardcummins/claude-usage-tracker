import type { HistoryPoint, Snapshot, UsageWindow } from './model.ts';

const RESET_MOVE_MS = 60 * 1000;

export function parseUsageResponse(body: unknown): { windows: UsageWindow[]; extraUsageLabel: string | null } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Usage response was not a JSON object.');
  }
  const record = body as Record<string, unknown>;
  const fromLimits = parseLimits(record.limits);
  const windows = dedupe(fromLimits.length > 0 ? fromLimits : parseLegacy(record));
  windows.sort(compareWindows);
  return { windows, extraUsageLabel: extraLabel(record.extra_usage) };
}

export function buildSnapshot(input: {
  fetchedAt: string;
  plan: string | null;
  timeZone: string;
  windows: UsageWindow[];
  extraUsageLabel: string | null;
  history: HistoryPoint[];
}): { snapshot: Snapshot; history: HistoryPoint[] } {
  const point = { t: input.fetchedAt, w: Object.fromEntries(input.windows.map((window) => [window.id, window.usedPercent])) };
  const history = [...input.history, point].slice(-18);
  return {
    history,
    snapshot: {
      v: 1,
      type: 'snapshot',
      fetchedAt: input.fetchedAt,
      plan: input.plan,
      timeZone: input.timeZone,
      windows: input.windows,
      extraUsageLabel: input.extraUsageLabel,
      recent: history,
    },
  };
}

export function detectResetWindows(previous: UsageWindow[] | null, next: UsageWindow[]): UsageWindow[] {
  if (!previous) return [];
  const prevById = new Map(previous.map((window) => [window.id, window]));
  const found: UsageWindow[] = [];
  for (const window of next) {
    const before = prevById.get(window.id);
    if (!before?.resetsAt || !window.resetsAt) continue;
    const oldMs = Date.parse(before.resetsAt);
    const newMs = Date.parse(window.resetsAt);
    if (!Number.isFinite(oldMs) || !Number.isFinite(newMs)) continue;
    if (newMs > oldMs + RESET_MOVE_MS) found.push(window);
  }
  return found;
}

export function planAlarms(input: {
  previous: UsageWindow[] | null;
  next: UsageWindow[];
  scheduled: Record<string, string>;
  now: number;
}): { notify: UsageWindow[]; scheduled: Record<string, string> } {
  const previousById = new Map((input.previous || []).map((window) => [window.id, window]));
  const notify = detectResetWindows(input.previous, input.next).filter((window) => {
    const before = previousById.get(window.id);
    return !before?.resetsAt || input.scheduled[window.id] !== before.resetsAt;
  });
  const scheduled: Record<string, string> = {};
  for (const window of input.next) {
    if (!window.resetsAt) continue;
    const when = Date.parse(window.resetsAt);
    if (!Number.isFinite(when) || when < input.now + 15000) continue;
    scheduled[window.id] = window.resetsAt;
  }
  return { notify, scheduled };
}

export function resetNotification(windows: UsageWindow[]): { title: string; body: string } {
  if (windows.length === 1) {
    const window = windows[0];
    return {
      title: `${window.label} reset`,
      body: `Your ${window.label} limit has reset. It is now at ${window.usedPercent}%.`,
    };
  }
  const lines = windows.map((window) => `${window.label}: now ${window.usedPercent}%`);
  return {
    title: 'Claude limits reset',
    body: lines.join('\n'),
  };
}

function parseLimits(limits: unknown): UsageWindow[] {
  if (!Array.isArray(limits)) return [];
  const windows: UsageWindow[] = [];
  for (const entry of limits) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const percent = asPercent(record.percent ?? record.utilization);
    if (percent == null) continue;
    const named = nameLimit(record);
    windows.push({
      id: named.id,
      label: named.label,
      shortLabel: named.shortLabel,
      usedPercent: percent,
      resetsAt: normalizeTime(record.resets_at ?? record.resetsAt),
      severity: typeof record.severity === 'string' ? record.severity : null,
    });
  }
  return windows;
}

function nameLimit(entry: Record<string, unknown>): { id: string; label: string; shortLabel: string } {
  const kind = String(entry.kind || '');
  const modelName = modelDisplayName(entry.scope);
  if (kind === 'session' || kind === 'five_hour') {
    return { id: 'session', label: '5-hour session', shortLabel: '5h' };
  }
  if (kind === 'weekly_all' || kind === 'seven_day') {
    return { id: 'weekly', label: 'Weekly (all models)', shortLabel: 'Week' };
  }
  if (modelName) {
    return { id: `weekly:${modelName}`, label: `Weekly (${modelName})`, shortLabel: modelName };
  }
  const id = slug(kind || 'window');
  const label = kind ? kind.replaceAll('_', ' ') : 'Usage window';
  return { id, label, shortLabel: label };
}

function modelDisplayName(scope: unknown): string | null {
  if (!scope || typeof scope !== 'object') return null;
  const model = (scope as { model?: unknown }).model;
  if (typeof model === 'string' && model.trim()) return model.trim();
  if (model && typeof model === 'object') {
    const name = (model as { display_name?: unknown }).display_name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
}

const LEGACY: Array<[string, string, string, string]> = [
  ['five_hour', 'session', '5-hour session', '5h'],
  ['seven_day', 'weekly', 'Weekly (all models)', 'Week'],
  ['seven_day_sonnet', 'weekly:Sonnet', 'Weekly (Sonnet)', 'Sonnet'],
  ['seven_day_opus', 'weekly:Opus', 'Weekly (Opus)', 'Opus'],
];

function parseLegacy(body: Record<string, unknown>): UsageWindow[] {
  const windows: UsageWindow[] = [];
  for (const [key, id, label, shortLabel] of LEGACY) {
    const entry = body[key];
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const percent = asPercent(record.utilization ?? record.used_percentage ?? record.percent);
    if (percent == null) continue;
    windows.push({
      id,
      label,
      shortLabel,
      usedPercent: percent,
      resetsAt: normalizeTime(record.resets_at ?? record.resetsAt),
      severity: null,
    });
  }
  return windows;
}

function extraLabel(extra: unknown): string | null {
  if (!extra || typeof extra !== 'object') return null;
  const record = extra as Record<string, unknown>;
  if (record.is_enabled !== true) return null;
  const limit = Number(record.monthly_limit);
  const used = Number(record.used_credits);
  if (!Number.isFinite(limit) || !Number.isFinite(used)) return null;
  return `Extra usage: $${(used / 100).toFixed(2)} of $${(limit / 100).toFixed(2)}`;
}

function asPercent(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  let text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) text += 'Z';
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function dedupe(windows: UsageWindow[]): UsageWindow[] {
  const byId = new Map<string, UsageWindow>();
  for (const window of windows) byId.set(window.id, window);
  return [...byId.values()];
}

function compareWindows(a: UsageWindow, b: UsageWindow): number {
  return rank(a.id) - rank(b.id) || a.label.localeCompare(b.label);
}

function rank(id: string): number {
  if (id === 'session') return 0;
  if (id === 'weekly') return 1;
  return 2;
}

function slug(value: string): string {
  const text = value.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return text || 'window';
}
