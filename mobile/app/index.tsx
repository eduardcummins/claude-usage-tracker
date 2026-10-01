import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notifyLocal, syncResetAlarms } from '../src/alerts';
import {
  barColor,
  formatAge,
  formatRemaining,
  formatWhen,
  isValidTopic,
  latestAlert,
  latestSnapshot,
  normalizeServer,
  NtfyMessage,
  parseNtfyLines,
  sampleReset,
  sampleSnapshot,
  Snapshot,
  topicFromInput,
  zoneLabel,
} from '../src/model';
import { loadSeen, loadSettings, saveSeen, saveSettings } from '../src/storage';

type Mode = 'loading' | 'setup' | 'live' | 'sample';

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>('loading');
  const [topic, setTopic] = useState('');
  const [server, setServer] = useState('https://ntfy.sh');
  const [draftTopic, setDraftTopic] = useState('');
  const [draftServer, setDraftServer] = useState('https://ntfy.sh');
  const [showServer, setShowServer] = useState(false);
  const [formError, setFormError] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [alert, setAlert] = useState<NtfyMessage | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [primed, setPrimed] = useState(false);
  const [alarmCount, setAlarmCount] = useState(0);

  const pull = useCallback(
    async (nextTopic: string, nextServer: string, alreadyPrimed: boolean) => {
      setRefreshing(true);
      setError('');
      try {
        const [usageText, alertText] = await Promise.all([
          readTopic(nextServer, `${nextTopic}-data`),
          readTopic(nextServer, nextTopic),
        ]);
        const usageMessages = parseNtfyLines(usageText);
        const alertMessages = parseNtfyLines(alertText);
        const nextSnapshot = latestSnapshot(usageMessages);
        setSnapshot(nextSnapshot);
        const nextAlert = latestAlert(alertMessages);
        setAlert(nextAlert);
        setAlarmCount(nextSnapshot ? await syncResetAlarms(nextSnapshot.windows) : 0);
        if (nextAlert) {
          const seen = await loadSeen();
          if (!alreadyPrimed) {
            if (!seen.includes(nextAlert.id)) await saveSeen([...seen, nextAlert.id]);
          } else if (!seen.includes(nextAlert.id)) {
            await saveSeen([...seen, nextAlert.id]);
            await notifyLocal(nextAlert.title || 'Claude usage', nextAlert.message);
          }
        }
        if (!alreadyPrimed) setPrimed(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reach ntfy.');
      } finally {
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadSettings();
      if (cancelled) return;
      if (saved.topic) {
        setTopic(saved.topic);
        setServer(saved.server);
        setDraftTopic(saved.topic);
        setDraftServer(saved.server);
        await pull(saved.topic, saved.server, false);
        if (!cancelled) setMode('live');
      } else if (!cancelled) {
        setMode('setup');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pull]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mode !== 'live' || !topic) return undefined;
    const timer = setInterval(() => {
      void pull(topic, server, true);
    }, 20000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void pull(topic, server, true);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [mode, topic, server, pull]);

  async function onSave() {
    const nextTopic = topicFromInput(draftTopic);
    const nextServer = normalizeServer(draftServer);
    if (!isValidTopic(nextTopic)) {
      setFormError('Paste the topic from the computer. It looks like cu- followed by letters and numbers.');
      return;
    }
    if (!/^https:\/\//i.test(nextServer)) {
      setFormError('The server must start with https://');
      return;
    }
    setFormError('');
    await saveSettings(nextTopic, nextServer);
    setTopic(nextTopic);
    setServer(nextServer);
    setPrimed(false);
    setMode('live');
    await pull(nextTopic, nextServer, false);
  }

  function showSample() {
    const sample = sampleSnapshot();
    setSnapshot(sample);
    setAlert(null);
    setError('');
    setMode('sample');
  }

  async function simulateReset() {
    if (!snapshot) return;
    const next = sampleReset(snapshot);
    setSnapshot(next);
    const message: NtfyMessage = {
      id: `sample-${Date.now()}`,
      time: Math.floor(Date.now() / 1000),
      title: '5-hour session reset',
      message: 'Your 5-hour session limit has reset. This is a sample alert on this phone.',
      tags: ['reset'],
      topic: 'sample',
    };
    setAlert(message);
    await notifyLocal(message.title, message.message);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {mode === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#0f6e56" />
          </View>
        ) : mode === 'setup' ? (
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Claude usage</Text>
            <Text style={styles.lede}>
              Paste the topic printed by the helper on your computer. This screen then shows how
              much of your Claude plan is used, and when it resets.
            </Text>
            <Text style={styles.label}>Phone topic</Text>
            <TextInput
              value={draftTopic}
              onChangeText={setDraftTopic}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="cu-…"
              placeholderTextColor="#8a8175"
              style={styles.input}
            />
            <Pressable onPress={() => setShowServer((value) => !value)} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>
                {showServer ? 'Hide server' : 'Use a different ntfy server'}
              </Text>
            </Pressable>
            {showServer ? (
              <TextInput
                value={draftServer}
                onChangeText={setDraftServer}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            ) : null}
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Pressable style={styles.primary} onPress={() => void onSave()}>
              <Text style={styles.primaryLabel}>Save and check</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={showSample}>
              <Text style={styles.secondaryLabel}>Preview with sample data</Text>
            </Pressable>
            <Text style={styles.note}>
              Locked-phone alerts come from the free ntfy app, subscribed to the same topic. While
              this app is open it can alert as well. Allow notifications if the phone asks.
            </Text>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.page}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Claude usage</Text>
              {snapshot?.plan ? <Text style={styles.plan}>{snapshot.plan}</Text> : null}
            </View>
            {mode === 'sample' ? (
              <Text style={styles.sampleBanner}>Sample data. This is not your Claude account.</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {alert ? (
              <View style={styles.alertBanner}>
                <Text style={styles.alertTitle}>{alert.title || 'Claude usage'}</Text>
                <Text style={styles.alertBody}>{alert.message}</Text>
              </View>
            ) : null}
            {snapshot ? (
              <UsageBody snapshot={snapshot} now={now} />
            ) : (
              <Text style={styles.lede}>
                No usage report yet. On your computer run node helper/cli.js once, then tap Refresh.
              </Text>
            )}
            <View style={styles.actions}>
              {mode === 'live' ? (
                <Pressable
                  style={styles.primary}
                  onPress={() => void pull(topic, server, true)}
                  disabled={refreshing}
                >
                  <Text style={styles.primaryLabel}>{refreshing ? 'Checking…' : 'Refresh'}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.primary} onPress={() => void simulateReset()}>
                  <Text style={styles.primaryLabel}>Simulate a reset</Text>
                </Pressable>
              )}
              {mode === 'sample' ? (
                <Pressable
                  style={styles.secondary}
                  onPress={() => {
                    if (!topic) {
                      setMode('setup');
                      return;
                    }
                    setAlert(null);
                    setMode('live');
                    void pull(topic, server, true);
                  }}
                >
                  <Text style={styles.secondaryLabel}>{topic ? 'Back to live topic' : 'Back'}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.secondary}
                  onPress={() => {
                    setDraftTopic(topic);
                    setDraftServer(server);
                    setMode('setup');
                  }}
                >
                  <Text style={styles.secondaryLabel}>Change topic</Text>
                </Pressable>
              )}
              {mode === 'live' ? (
                <Pressable style={styles.textButton} onPress={showSample}>
                  <Text style={styles.textButtonLabel}>Preview with sample data</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.note}>
              Numbers come from your Claude plan, checked on your computer about every 10 minutes.
              Times are {zoneLabel(snapshot?.timeZone)}.
              {mode === 'live' && alarmCount > 0
                ? ' This phone will also alert at the reset time, even if the app is closed.'
                : ''}{' '}
              The ntfy app alerts as well, including when this app has not been opened.
            </Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function UsageBody({ snapshot, now }: { snapshot: Snapshot; now: number }) {
  const ageMs = now - Date.parse(snapshot.fetchedAt);
  const stale = Number.isFinite(ageMs) && ageMs > 25 * 60 * 1000;
  const zone = snapshot.timeZone || 'Europe/London';
  return (
    <View>
      <Text style={styles.updated}>
        Updated {formatAge(snapshot.fetchedAt, now)} · {formatWhen(snapshot.fetchedAt, zone)}
      </Text>
      {stale ? (
        <Text style={styles.stale}>
          This report is old. The helper on your computer may be asleep or not running.
        </Text>
      ) : null}
      {snapshot.windows.map((window) => {
        const percent = Math.max(0, Math.min(100, window.usedPercent));
        return (
          <View key={window.id} style={styles.card}>
            <Text style={styles.cardLabel}>{window.label}</Text>
            <Text style={styles.percent}>{percent}%</Text>
            <View style={styles.track}>
              <View
                style={[styles.fill, { width: `${percent}%`, backgroundColor: barColor(percent) }]}
              />
            </View>
            <Text style={styles.cardDetail}>
              {percent >= 100 ? 'Limit reached. ' : 'Used. '}
              {window.resetsAt ? formatRemaining(window.resetsAt, now) : 'No reset time reported.'}
            </Text>
            {window.resetsAt ? (
              <Text style={styles.cardTime}>
                {formatWhen(window.resetsAt, zone)} {zoneLabel(zone)}
              </Text>
            ) : null}
          </View>
        );
      })}
      {snapshot.extraUsageLabel ? <Text style={styles.extra}>{snapshot.extraUsageLabel}</Text> : null}
      {snapshot.recent.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Recent checks</Text>
          {[...snapshot.recent].reverse().slice(0, 8).map((point) => (
            <Text key={point.t} style={styles.historyRow}>
              {formatWhen(point.t, zone)}
              {snapshot.windows.map((window) =>
                point.w[window.id] == null ? '' : `   ${window.shortLabel} ${point.w[window.id]}%`,
              )}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

async function readTopic(server: string, topic: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${server}/${encodeURIComponent(topic)}/json?poll=1&since=24h`);
  } catch {
    throw new Error('Could not reach ntfy. Check the phone’s connection and the topic.');
  }
  if (!response.ok) {
    throw new Error(`ntfy returned ${response.status}. Check the topic and server.`);
  }
  return response.text();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3efe6' },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1c1915', marginTop: 12 },
  plan: { color: '#5c564e', fontSize: 16 },
  lede: { fontSize: 16, lineHeight: 22, color: '#3f3a34', marginTop: 8, marginBottom: 16 },
  label: { fontSize: 14, color: '#5c564e', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d9d0c3',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1c1915',
  },
  primary: {
    backgroundColor: '#0f6e56',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: '#0f6e56',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryLabel: { color: '#0f6e56', fontSize: 16, fontWeight: '600' },
  textButton: { paddingVertical: 10 },
  textButtonLabel: { color: '#0f6e56', fontSize: 15 },
  note: { color: '#5c564e', fontSize: 14, lineHeight: 20, marginTop: 18 },
  error: {
    backgroundColor: '#f8e6e4',
    color: '#6d1f1f',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  sampleBanner: {
    backgroundColor: '#efe6c8',
    color: '#3f3a34',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    fontSize: 15,
  },
  alertBanner: {
    backgroundColor: '#e5f3ee',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  alertTitle: { fontSize: 16, fontWeight: '700', color: '#0f6e56' },
  alertBody: { fontSize: 15, lineHeight: 21, color: '#1c1915', marginTop: 4 },
  updated: { color: '#5c564e', marginTop: 8, fontSize: 14 },
  stale: { color: '#8a5a00', marginTop: 8, fontSize: 15, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e6dfd4',
  },
  cardLabel: { fontSize: 16, color: '#3f3a34' },
  percent: { fontSize: 40, fontWeight: '700', color: '#1c1915', marginVertical: 4 },
  track: { height: 10, backgroundColor: '#e6e0d6', borderRadius: 99, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 99 },
  cardDetail: { marginTop: 8, fontSize: 16, color: '#1c1915' },
  cardTime: { marginTop: 2, fontSize: 14, color: '#5c564e' },
  extra: { marginTop: 12, fontSize: 15, color: '#3f3a34' },
  history: { marginTop: 18 },
  historyTitle: { fontSize: 16, fontWeight: '700', color: '#1c1915', marginBottom: 6 },
  historyRow: { fontSize: 14, color: '#3f3a34', paddingVertical: 3 },
  actions: { marginTop: 4 },
});
