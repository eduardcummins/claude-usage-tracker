import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  formatAge,
  formatRemaining,
  formatWhen,
  sampleSnapshot,
  Snapshot,
  zoneLabel,
} from '../src/model';
import { ensureBackground } from '../src/register-background';
import { forgetTopic, runSync, saveTopic } from '../src/sync-runner';
import { barColor, dark, light, Palette } from '../src/theme';

export default function HomeScreen() {
  const colors = useColorScheme() === 'dark' ? dark : light;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [confirmForget, setConfirmForget] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const outcome = await runSync(true);
      setConnected(outcome.connected);
      setWaiting(outcome.waiting);
      setSnapshot(outcome.snapshot);
      setError(outcome.error || '');
      if (outcome.connected) await ensureBackground();
      return outcome;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check usage.');
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refresh().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!connected) return undefined;
    const timer = setInterval(() => {
      void refresh();
    }, 5 * 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [connected, refresh]);

  async function save() {
    setBusy('save');
    setError('');
    try {
      await saveTopic(topic);
      setEditing(false);
      setSample(false);
      setConfirmForget(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the topic.');
    } finally {
      setBusy('');
    }
  }

  async function forget() {
    if (!confirmForget) {
      setConfirmForget(true);
      return;
    }
    setBusy('forget');
    setError('');
    try {
      await forgetTopic();
      setConnected(false);
      setWaiting(false);
      setSnapshot(null);
      setSample(false);
      setTopic('');
      setEditing(false);
      setConfirmForget(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not forget the topic.');
    } finally {
      setBusy('');
    }
  }

  const shown = sample ? sampleSnapshot(now) : snapshot;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!ready ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.page}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              connected && !sample && !editing ? (
                <RefreshControl
                  refreshing={busy === 'refresh'}
                  tintColor={colors.accent}
                  onRefresh={() => {
                    setBusy('refresh');
                    void refresh().finally(() => setBusy(''));
                  }}
                />
              ) : undefined
            }
          >
            <Text style={styles.title}>Plan Pace</Text>
            {sample ? <Text style={styles.banner}>Sample numbers. This is not your account.</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {connected && !sample && !editing && shown ? (
              <UsageBody snapshot={shown} now={now} styles={styles} colors={colors} />
            ) : null}
            {connected && !sample && !editing && waiting ? (
              <Text style={styles.lede}>
                No report yet. The computer sends one about every 10 minutes. Leave the Mac awake.
              </Text>
            ) : null}
            {sample && shown ? <UsageBody snapshot={shown} now={now} styles={styles} colors={colors} /> : null}

            {(!connected || editing) && !sample ? (
              <View>
                <Text style={styles.lede}>
                  This phone reads the usage report your computer already publishes. Paste the topic from the Mac
                  helper. The ntfy app is not needed.
                </Text>
                <Text style={styles.step}>On the Mac, the topic is the line that starts with “Phone topic”.</Text>
                <Text style={styles.label}>Topic</Text>
                <TextInput
                  value={topic}
                  onChangeText={setTopic}
                  autoCapitalize="none"
                  autoCorrect={false}
                  nativeID="planpace-topic"
                  placeholder="Paste the topic"
                  placeholderTextColor={colors.muted}
                  style={styles.topicInput}
                />
                <Pressable style={styles.primary} onPress={() => void save()} disabled={busy !== '' || topic.trim() === ''}>
                  <Text style={styles.primaryLabel}>{busy === 'save' ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.actions}>
              {connected && !sample && !editing ? (
                <Pressable
                  style={styles.secondary}
                  onPress={() => {
                    setBusy('refresh');
                    void refresh().finally(() => setBusy(''));
                  }}
                  disabled={busy !== ''}
                >
                  <Text style={styles.secondaryLabel}>{busy === 'refresh' ? 'Checking…' : 'Check now'}</Text>
                </Pressable>
              ) : null}
              {sample ? (
                <Pressable style={styles.secondary} onPress={() => setSample(false)}>
                  <Text style={styles.secondaryLabel}>{connected ? 'Back to your plan' : 'Back'}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.textButton}
                  onPress={() => {
                    setError('');
                    setSample(true);
                    setEditing(false);
                  }}
                >
                  <Text style={styles.textButtonLabel}>See sample numbers</Text>
                </Pressable>
              )}
              {connected && !editing ? (
                <Pressable
                  style={styles.textButton}
                  onPress={() => {
                    setConfirmForget(false);
                    setEditing(true);
                  }}
                >
                  <Text style={styles.textButtonLabel}>Change topic</Text>
                </Pressable>
              ) : null}
              {connected ? (
                <Pressable style={styles.textButton} onPress={() => void forget()} disabled={busy === 'forget'}>
                  <Text style={styles.textButtonLabel}>
                    {busy === 'forget'
                      ? 'Removing…'
                      : confirmForget
                        ? 'Tap again to remove the topic from this phone'
                        : 'Remove topic'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {Platform.OS === 'android' ? (
              <Text style={styles.note}>
                Home screen widget: long-press the home screen, tap Widgets, and add Plan Pace. It shows the 5-hour
                and weekly percents. Add it after you have saved a topic, then open the app once so the widget fills in.
              </Text>
            ) : null}
            <Text style={styles.note}>
              The phone checks the saved topic again in the background, usually every 15 minutes or longer. The phone
              decides the exact time. Opening the app checks immediately. A notification is also set for each reset
              time. Allow notifications
              {Platform.OS === 'android' ? ', and on Android 12 or newer allow Alarms & reminders for Plan Pace' : ''}.
            </Text>
            <Text style={styles.footer}>Plan Pace is not affiliated with Anthropic.</Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function UsageBody({
  snapshot,
  now,
  styles,
  colors,
}: {
  snapshot: Snapshot;
  now: number;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  const ageMs = now - Date.parse(snapshot.fetchedAt);
  const stale = Number.isFinite(ageMs) && ageMs > 30 * 60 * 1000;
  const zone = snapshot.timeZone || 'Europe/London';
  return (
    <View>
      <Text style={styles.updated}>
        Updated {formatAge(snapshot.fetchedAt, now)} · {formatWhen(snapshot.fetchedAt, zone)}
      </Text>
      {snapshot.plan ? <Text style={styles.plan}>{snapshot.plan}</Text> : null}
      {stale ? (
        <Text style={styles.stale}>These numbers are old. The Mac may be asleep.</Text>
      ) : null}
      {snapshot.windows.map((window) => {
        const percent = Math.max(0, Math.min(100, window.usedPercent));
        return (
          <View key={window.id} style={styles.card}>
            <Text style={styles.cardLabel}>{window.label}</Text>
            <Text style={styles.percent}>{percent}%</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${percent}%`, backgroundColor: barColor(percent, colors) }]} />
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

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    page: {
      paddingHorizontal: 20,
      paddingBottom: 36,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    title: { fontSize: 32, fontWeight: '700', color: colors.text, marginTop: 12 },
    lede: { fontSize: 17, lineHeight: 24, color: colors.text, marginTop: 10 },
    step: { fontSize: 16, lineHeight: 22, color: colors.text, marginTop: 8 },
    label: { fontSize: 14, color: colors.muted, marginTop: 16, marginBottom: 6 },
    topicInput: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
    },
    primary: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 16,
    },
    primaryLabel: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
    secondary: {
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
    },
    secondaryLabel: { color: colors.accent, fontSize: 16, fontWeight: '600' },
    textButton: { paddingVertical: 12, alignItems: 'center' },
    textButtonLabel: { color: colors.accent, fontSize: 15 },
    note: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 16 },
    footer: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 18 },
    error: {
      backgroundColor: colors.errorBg,
      color: colors.errorText,
      padding: 12,
      borderRadius: 12,
      marginTop: 12,
      fontSize: 15,
      lineHeight: 20,
    },
    banner: {
      backgroundColor: colors.banner,
      color: colors.text,
      padding: 12,
      borderRadius: 12,
      marginTop: 12,
      fontSize: 15,
    },
    plan: { color: colors.text, marginTop: 8, fontSize: 16, fontWeight: '600' },
    updated: { color: colors.muted, marginTop: 10, fontSize: 14 },
    stale: { color: colors.warn, marginTop: 8, fontSize: 15, lineHeight: 20 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.line,
    },
    cardLabel: { fontSize: 16, color: colors.muted },
    percent: { fontSize: 42, fontWeight: '700', color: colors.text, marginVertical: 4 },
    track: { height: 8, backgroundColor: colors.track, borderRadius: 99, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 99 },
    cardDetail: { marginTop: 10, fontSize: 16, color: colors.text },
    cardTime: { marginTop: 2, fontSize: 14, color: colors.muted },
    extra: { marginTop: 12, fontSize: 15, color: colors.text },
    history: { marginTop: 18 },
    historyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
    historyRow: { fontSize: 14, color: colors.muted, paddingVertical: 3 },
    actions: { marginTop: 8 },
  });
}
