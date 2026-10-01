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
