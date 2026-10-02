import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Snapshot } from '../src/model';
import { ensureBackground } from '../src/register-background';
import { forgetTopic, runSync } from '../src/sync-runner';
import { bodyFont, dark, light } from '../src/theme';
import { LoadingView, UsageHome } from '../src/usage-view';

export default function HomeScreen() {
  const colors = useColorScheme() === 'dark' ? dark : light;
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
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
    if (ready && !connected) router.replace('/setup');
  }, [ready, connected]);

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
      setConfirmForget(false);
      router.replace('/setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the topic.');
    } finally {
      setBusy('');
    }
  }

  if (!ready || !connected) return <LoadingView colors={colors} />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={busy === 'refresh'}
            tintColor={colors.accent}
            onRefresh={() => {
              setBusy('refresh');
              void refresh().finally(() => setBusy(''));
            }}
          />
        }
      >
        <UsageHome
          colors={colors}
          snapshot={snapshot}
          now={now}
          error={error}
          waiting={waiting}
          busy={busy}
          confirmForget={confirmForget}
          onHelp={() => router.push('/help')}
          onRefresh={() => {
            setBusy('refresh');
            void refresh().finally(() => setBusy(''));
          }}
          onChangeTopic={() => router.push('/setup?step=topic')}
          onForget={() => void forget()}
        />
        {Platform.OS === 'android' ? (
          <Text style={[styles.note, { color: colors.muted }]}>
            Home screen widgets: long-press the home screen, tap Widgets, and add Cluse, Cluse session, or Cluse bars.
          </Text>
        ) : null}
        <Text style={[styles.note, { color: colors.muted }]}>
          The phone checks again in the background, usually every 15 minutes or longer. A notification is set for
          each reset time. Allow notifications
          {Platform.OS === 'android' ? ', and on Android 12 or newer allow Alarms & reminders' : ''}.
        </Text>
        <Text style={[styles.footer, { color: colors.muted }]}>Cluse is not affiliated with Anthropic.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: {
    paddingHorizontal: 22,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  note: {
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
  footer: {
    fontFamily: bodyFont,
    fontSize: 13,
    marginTop: 18,
  },
});
