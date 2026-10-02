import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { HelpBody } from '../src/help-view';
import { sampleSnapshot } from '../src/model';
import { SetupFlow } from '../src/setup-view';
import { dark, light, Palette } from '../src/theme';
import { UsageHome } from '../src/usage-view';
import { barColor, barSegments, widgetMetrics, widgetPalettes, type WidgetScheme } from '../src/widget-layout';

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
    return <WidgetCard scheme={colors === dark ? 'dark' : 'light'} />;
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

function WidgetCard({ scheme }: { scheme: WidgetScheme }) {
  const colors = widgetPalettes[scheme];
  const metrics = widgetMetrics(320, 180);
  const inner = 320 - metrics.padX * 2;
  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderRadius: metrics.radius,
        paddingHorizontal: metrics.padX,
        paddingVertical: metrics.padY,
        marginTop: 24,
        width: 320,
        alignSelf: 'center',
      }}
    >
      <View style={widget.row}>
        <Text style={{ color: colors.muted, fontSize: metrics.title }}>Cluse</Text>
        <Text style={{ color: colors.accent, fontSize: metrics.title }}>Pro</Text>
      </View>
      <PreviewMeter label="5-hour" percent={16} when="resets in 3h 12m" inner={inner} scheme={scheme} />
      <PreviewMeter label="Weekly" percent={13} when="resets in 4d 2h" inner={inner} scheme={scheme} />
    </View>
  );
}

function PreviewMeter({
  label,
  percent,
  when,
  inner,
  scheme,
}: {
  label: string;
  percent: number;
  when: string;
  inner: number;
  scheme: WidgetScheme;
}) {
  const colors = widgetPalettes[scheme];
  const metrics = widgetMetrics(320, 180);
  const color = barColor(percent, colors);
  const parts = barSegments(inner, percent, metrics.thumb);
  const left = Math.round(parts.left);
  const right = Math.max(0, inner - left - metrics.thumb);
  return (
    <View style={{ marginTop: metrics.gap }}>
      <View style={widget.row}>
        <Text style={{ color: colors.ink, fontSize: metrics.label }}>{label}</Text>
        <Text style={{ color, fontSize: metrics.percent, fontWeight: '700' }}>{percent}%</Text>
      </View>
      <View style={{ flexDirection: 'row', width: inner, height: metrics.thumb, alignItems: 'center', marginTop: 5 }}>
        {left > 0 ? (
          <View
            style={{
              width: left,
              height: metrics.bar,
              backgroundColor: color,
              borderTopLeftRadius: metrics.bar,
              borderBottomLeftRadius: metrics.bar,
            }}
          />
        ) : null}
        <View
          style={{
            width: metrics.thumb,
            height: metrics.thumb,
            borderRadius: metrics.thumb / 2,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: colors.bg,
          }}
        />
        {right > 0 ? (
          <View
            style={{
              width: right,
              height: metrics.bar,
              backgroundColor: colors.track,
              borderTopRightRadius: metrics.bar,
              borderBottomRightRadius: metrics.bar,
            }}
          />
        ) : null}
      </View>
      <Text style={{ color: colors.muted, fontSize: metrics.meta, marginTop: 4 }}>{when}</Text>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
