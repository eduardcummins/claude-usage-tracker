import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { HelpBody } from '../src/help-view';
import { sampleSnapshot } from '../src/model';
import { SetupFlow } from '../src/setup-view';
import { dark, light, Palette } from '../src/theme';
import { UsageHome } from '../src/usage-view';

export default function PreviewScreen() {
  const params = useLocalSearchParams<{ screen?: string; scheme?: string }>();
  if (process.env.EXPO_PUBLIC_PREVIEWS !== '1') return <Redirect href="/" />;
  const system = useColorScheme() === 'dark' ? dark : light;
  const colors = params.scheme === 'dark' ? dark : params.scheme === 'light' ? light : system;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <PreviewBody screen={String(params.screen || 'meters')} colors={colors} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PreviewBody({ screen, colors }: { screen: string; colors: Palette }) {
  const now = Date.now();
  const base = sampleSnapshot(now);
  const fresh = {
    ...base,
    plan: 'Pro',
    fetchedAt: new Date(now - 4 * 60 * 1000).toISOString(),
    windows: base.windows.map((window) =>
      window.id === 'session' ? { ...window, usedPercent: 16 } : { ...window, usedPercent: 13 },
    ),
  };
  const stale = { ...fresh, fetchedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() };
  if (screen === 'widget') {
    return <WidgetCard />;
  }
  if (screen === 'welcome') {
    return <SetupPreview colors={colors} step={0} />;
  }
  if (screen === 'install') {
    return <SetupPreview colors={colors} step={1} />;
  }
  if (screen === 'topic') {
    return <SetupPreview colors={colors} step={2} />;
  }
  if (screen === 'help') {
    return <HelpBody colors={colors} onBack={() => undefined} />;
  }
  if (screen === 'waiting') {
    return (
      <UsageHome
        colors={colors}
        snapshot={null}
        now={now}
        error=""
        waiting
        busy=""
        confirmForget={false}
        onHelp={() => undefined}
        onRefresh={() => undefined}
        onChangeTopic={() => undefined}
        onForget={() => undefined}
      />
    );
  }
  if (screen === 'error') {
    return (
      <UsageHome
        colors={colors}
        snapshot={fresh}
        now={now}
        error="Could not read the topic (HTTP 404). The last report is still shown."
        waiting={false}
        busy=""
        confirmForget={false}
        onHelp={() => undefined}
        onRefresh={() => undefined}
        onChangeTopic={() => undefined}
        onForget={() => undefined}
      />
    );
  }
  if (screen === 'stale') {
    return (
      <UsageHome
        colors={colors}
        snapshot={stale}
        now={now}
        error=""
        waiting={false}
        busy=""
        confirmForget={false}
        onHelp={() => undefined}
        onRefresh={() => undefined}
        onChangeTopic={() => undefined}
        onForget={() => undefined}
      />
    );
  }
  return (
    <UsageHome
      colors={colors}
      snapshot={fresh}
      now={now}
      error=""
      waiting={false}
      busy=""
      confirmForget={false}
      onHelp={() => undefined}
      onRefresh={() => undefined}
      onChangeTopic={() => undefined}
      onForget={() => undefined}
    />
  );
}

function WidgetCard() {
  return (
    <View style={widget.card}>
      <View style={widget.row}>
        <Text style={widget.brand}>Plan Pace</Text>
        <Text style={widget.plan}>Pro</Text>
      </View>
      <Meter label="5-hour" percent={16} when="resets in 2h 14m" />
      <Meter label="Weekly" percent={13} when="resets in 3d" />
    </View>
  );
}

function Meter({ label, percent, when }: { label: string; percent: number; when: string }) {
  return (
    <View style={widget.meter}>
      <View style={widget.row}>
        <Text style={widget.label}>{label}</Text>
        <Text style={widget.percent}>{percent}%</Text>
      </View>
      <View style={widget.track}>
        <View style={[widget.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={widget.when}>{when}</Text>
    </View>
  );
}

function SetupPreview({ colors, step }: { colors: Palette; step: number }) {
  return (
    <SetupFlow
      colors={colors}
      step={step}
      computer="mac"
      topic=""
      copied={false}
      busy=""
      error=""
      onComputer={() => undefined}
      onTopic={() => undefined}
      onCopy={() => undefined}
      onScan={() => undefined}
      onBack={() => undefined}
      onNext={() => undefined}
      onSave={() => undefined}
      onHelp={() => undefined}
    />
  );
}

const widget = StyleSheet.create({
  card: {
    backgroundColor: '#faf9f5',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7e2d8',
    marginTop: 24,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#6b6a64', fontSize: 13 },
  plan: { color: '#c96442', fontSize: 13 },
  meter: { marginTop: 12 },
  label: { color: '#141413', fontSize: 16 },
  percent: { color: '#c96442', fontSize: 22, fontWeight: '700' },
  track: { height: 8, backgroundColor: '#efeae1', borderRadius: 8, marginTop: 6, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#c96442', borderRadius: 8 },
  when: { color: '#6b6a64', fontSize: 13, marginTop: 4 },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: {
    paddingHorizontal: 22,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
