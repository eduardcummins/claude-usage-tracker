import AsyncStorage from '@react-native-async-storage/async-storage';

const TOPIC = 'claude-usage-topic';
const SERVER = 'claude-usage-server';
const SEEN = 'claude-usage-seen';

export async function loadSettings(): Promise<{ topic: string; server: string }> {
  const [topic, server] = await Promise.all([
    AsyncStorage.getItem(TOPIC),
    AsyncStorage.getItem(SERVER),
  ]);
  return {
    topic: topic || '',
    server: server || 'https://ntfy.sh',
  };
}

export async function saveSettings(topic: string, server: string): Promise<void> {
  await AsyncStorage.multiSet([
    [TOPIC, topic],
    [SERVER, server],
  ]);
}

export async function loadSeen(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(SEEN);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export async function saveSeen(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(SEEN, JSON.stringify(ids.slice(-200)));
}

const WIDGET = 'planpace-widget';
const HISTORY = 'planpace-history';
const WINDOWS = 'planpace-windows';
const SCHEDULED = 'planpace-scheduled';
const SNAPSHOT = 'planpace-snapshot';

export type WidgetCache = {
  signedIn: boolean;
  plan: string | null;
  sessionPercent: number | null;
  sessionReset: string | null;
  weeklyPercent: number | null;
  weeklyReset: string | null;
  fetchedAt: string | null;
};

export const emptyWidget: WidgetCache = {
  signedIn: false,
  plan: null,
  sessionPercent: null,
  sessionReset: null,
  weeklyPercent: null,
  weeklyReset: null,
  fetchedAt: null,
};

export async function loadWidgetCache(): Promise<WidgetCache> {
  return { ...emptyWidget, ...(await readJson<Partial<WidgetCache>>(WIDGET)) };
}

export async function saveWidgetCache(cache: WidgetCache): Promise<void> {
  await AsyncStorage.setItem(WIDGET, JSON.stringify(cache));
}

export async function loadHistory(): Promise<import('./model.ts').HistoryPoint[]> {
  const value = await readJson<import('./model.ts').HistoryPoint[]>(HISTORY);
  return Array.isArray(value) ? value : [];
}

export async function saveHistory(history: import('./model.ts').HistoryPoint[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY, JSON.stringify(history.slice(-18)));
}

export async function loadWindows(): Promise<import('./model.ts').UsageWindow[] | null> {
  const value = await readJson<import('./model.ts').UsageWindow[]>(WINDOWS);
  return Array.isArray(value) ? value : null;
}

export async function saveWindows(windows: import('./model.ts').UsageWindow[]): Promise<void> {
  await AsyncStorage.setItem(WINDOWS, JSON.stringify(windows));
}

export async function loadScheduled(): Promise<Record<string, string>> {
  const value = await readJson<Record<string, string>>(SCHEDULED);
  return value && typeof value === 'object' ? value : {};
}

export async function saveScheduled(scheduled: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(SCHEDULED, JSON.stringify(scheduled));
}

export async function loadSnapshot(): Promise<import('./model.ts').Snapshot | null> {
  const value = await readJson<import('./model.ts').Snapshot>(SNAPSHOT);
  if (!value || value.type !== 'snapshot' || !Array.isArray(value.windows)) return null;
  return value;
}

export async function saveSnapshot(snapshot: import('./model.ts').Snapshot): Promise<void> {
  await AsyncStorage.setItem(SNAPSHOT, JSON.stringify(snapshot));
}

export async function clearPlanData(): Promise<void> {
  await AsyncStorage.multiRemove([WIDGET, HISTORY, WINDOWS, SCHEDULED, SNAPSHOT]);
}

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
