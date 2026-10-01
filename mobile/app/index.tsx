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
import * as WebBrowser from 'expo-web-browser';
import {
  formatAge,
  formatRemaining,
  formatWhen,
  sampleSnapshot,
  Snapshot,
  zoneLabel,
} from '../src/model';
import { ensureBackground } from '../src/register-background';
import { createLoginAttempt } from '../src/secure-session';
import { finishSignIn, runSync, signOut } from '../src/sync-runner';
import { barColor, dark, light, Palette } from '../src/theme';

export default function HomeScreen() {
  const colors = useColorScheme() === 'dark' ? dark : light;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmOut, setConfirmOut] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const outcome = await runSync(true);
      setSignedIn(!outcome.signedOut);
      setSnapshot(outcome.snapshot);
      setError(outcome.error || '');
      if (!outcome.signedOut) await ensureBackground();
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
    if (!signedIn) return undefined;
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
  }, [signedIn, refresh]);

  async function openSignIn() {
    setBusy('browser');
    setError('');
    try {
      const attempt = await createLoginAttempt();
      await WebBrowser.openBrowserAsync(attempt.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the sign-in page.');
    } finally {
      setBusy('');
    }
  }

  async function connect() {
    setBusy('connect');
    setError('');
    try {
      await finishSignIn(code);
      setCode('');
      setSample(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect.');
    } finally {
      setBusy('');
    }
  }

  async function disconnect() {
    if (!confirmOut) {
      setConfirmOut(true);
      return;
    }
    setBusy('signout');
    setError('');
    try {
      await signOut();
      setSignedIn(false);
      setSnapshot(null);
      setSample(false);
      setConfirmOut(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out.');
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
              signedIn && !sample ? (
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

            {signedIn && !sample && shown ? (
              <UsageBody snapshot={shown} now={now} styles={styles} colors={colors} />
            ) : null}
            {signedIn && !sample && !shown ? (
              <Text style={styles.lede}>Checking your plan. This takes a moment the first time.</Text>
            ) : null}
            {sample && shown ? <UsageBody snapshot={shown} now={now} styles={styles} colors={colors} /> : null}

            {!signedIn && !sample ? (
              <View>
                <Text style={styles.lede}>
                  This phone reads your plan usage itself. Sign in once, paste the code the website shows, and the
                  login stays on this phone.
                </Text>
                <Text style={styles.step}>1. Tap Open sign-in page. Sign in there if it asks.</Text>
                <Text style={styles.step}>2. The page shows a code. Copy the whole code, including anything after a #.</Text>
                <Text style={styles.step}>3. Come back here, paste it, and tap Connect.</Text>
                <Pressable style={styles.primary} onPress={() => void openSignIn()} disabled={busy !== ''}>
                  <Text style={styles.primaryLabel}>{busy === 'browser' ? 'Opening…' : 'Open sign-in page'}</Text>
                </Pressable>
                <Text style={styles.label}>Code from the sign-in page</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  nativeID="planpace-code"
                  placeholder="Paste the code"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                <Pressable style={styles.primary} onPress={() => void connect()} disabled={busy !== '' || code.trim() === ''}>
                  <Text style={styles.primaryLabel}>{busy === 'connect' ? 'Connecting…' : 'Connect'}</Text>
                </Pressable>
                <Text style={styles.note}>
                  The website cannot send you straight back into this app. Pasting the code is the same step the
                  plan’s own command-line login uses. The code works once and expires after about 10 minutes.
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {signedIn && !sample ? (
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
                  <Text style={styles.secondaryLabel}>{signedIn ? 'Back to your plan' : 'Back'}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.textButton}
                  onPress={() => {
                    setError('');
                    setSample(true);
                  }}
                >
                  <Text style={styles.textButtonLabel}>See sample numbers</Text>
                </Pressable>
              )}
              {signedIn ? (
                <Pressable style={styles.textButton} onPress={() => void disconnect()} disabled={busy === 'signout'}>
                  <Text style={styles.textButtonLabel}>
                    {busy === 'signout'
                      ? 'Signing out…'
                      : confirmOut
                        ? 'Tap again to delete the login from this phone'
                        : 'Sign out'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {Platform.OS === 'android' ? (
              <Text style={styles.note}>
                Home screen widget: long-press the home screen, tap Widgets, and add Plan Pace. It shows the 5-hour
                and weekly percents. Add it after you have connected, then open the app once so the widget fills in.
              </Text>
            ) : null}
            <Text style={styles.note}>
              The phone checks again in the background, usually every 15 minutes or longer. The phone decides the
              exact time. Opening the app checks immediately. A notification is also set for each reset time. Allow
              notifications
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
  const stale = Number.isFinite(ageMs) && ageMs > 45 * 60 * 1000;
  const zone = snapshot.timeZone || 'Europe/London';
  return (
    <View>
      <Text style={styles.updated}>
        Updated {formatAge(snapshot.fetchedAt, now)} · {formatWhen(snapshot.fetchedAt, zone)}
      </Text>
      {stale ? <Text style={styles.stale}>This report is old. Open the app with a connection, or tap Check now.</Text> : null}
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
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 88,
      fontSize: 16,
      color: colors.text,
      textAlignVertical: 'top',
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
