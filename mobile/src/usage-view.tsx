import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  deviceTimeZone,
  formatAge,
  formatRemaining,
  formatWhen,
  presentSnapshot,
  PresentedWindow,
  Snapshot,
} from './model';
import { barColor, bodyFont, displayFont, Palette } from './theme';

export const STALE_AFTER_MS = 30 * 60 * 1000;

export function LoadingView({ colors }: { colors: Palette }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.loading}>
      <Text style={styles.brand}>Cluse</Text>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
      <Text style={styles.quiet}>Reading the latest report</Text>
    </View>
  );
}

export function UsageHome({
  colors,
  snapshot,
  now,
  error,
  waiting,
  busy,
  confirmForget,
  onHelp,
  onRefresh,
  onChangeTopic,
  onForget,
}: {
  colors: Palette;
  snapshot: Snapshot | null;
  now: number;
  error: string;
  waiting: boolean;
  busy: string;
  confirmForget: boolean;
  onHelp: () => void;
  onRefresh: () => void;
  onChangeTopic: () => void;
  onForget: () => void;
}) {
  const styles = makeStyles(colors);
  const zone = deviceTimeZone();
  const presented = snapshot ? presentSnapshot(snapshot, now) : null;
  const stale = snapshot != null && !presented?.waitingNote && now - Date.parse(snapshot.fetchedAt) > STALE_AFTER_MS;
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.brand}>Cluse</Text>
        <Pressable onPress={onHelp} hitSlop={12}>
          <Text style={styles.headerLink}>Help</Text>
        </Pressable>
      </View>
      {snapshot && snapshot.windows.length > 0 ? (
        <Text style={styles.quiet}>
          Updated {formatAge(snapshot.fetchedAt, now)} · {formatWhen(snapshot.fetchedAt, zone)}
        </Text>
      ) : null}
      {error ? <Notice colors={colors} tone="error" text={error} /> : null}
      {presented?.waitingNote ? <Notice colors={colors} tone="warn" text={presented.waitingNote} /> : null}
      {stale ? (
        <Notice colors={colors} tone="warn" text="These numbers are old. The computer may be asleep." />
      ) : null}
      {waiting ? (
        <View style={styles.empty}>
          <UsageRing percent={null} size={120} color={colors.accent} track={colors.track} />
          <Text style={styles.emptyTitle}>No report yet</Text>
          <Text style={styles.quietCenter}>
            The computer sends one about every 10 minutes whenever it is awake and Claude Code is signed in.
          </Text>
        </View>
      ) : null}
      {presented?.windows.map((window) => (
        <MeterCard key={window.id} window={window} now={now} zone={zone} colors={colors} />
      ))}
      {snapshot?.extraUsageLabel ? <Text style={styles.extra}>{snapshot.extraUsageLabel}</Text> : null}
      {snapshot && snapshot.recent.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Recent checks</Text>
          {[...snapshot.recent].reverse().slice(0, 6).map((point) => (
            <Text key={point.t} style={styles.historyRow}>
              {formatWhen(point.t, zone)}
              {snapshot.windows.map((window) =>
                point.w[window.id] == null ? '' : `   ${window.shortLabel} ${point.w[window.id]}%`,
              )}
            </Text>
          ))}
        </View>
      ) : null}
      <Pressable style={styles.primary} onPress={onRefresh} disabled={busy !== ''}>
        <Text style={styles.primaryLabel}>{busy === 'refresh' ? 'Checking…' : 'Check now'}</Text>
      </Pressable>
      <Pressable style={styles.textButton} onPress={onChangeTopic}>
        <Text style={styles.textButtonLabel}>Change topic</Text>
      </Pressable>
      <Pressable style={styles.textButton} onPress={onForget} disabled={busy === 'forget'}>
        <Text style={styles.textButtonLabel}>
          {busy === 'forget' ? 'Removing…' : confirmForget ? 'Tap again to remove the topic' : 'Remove topic'}
        </Text>
      </Pressable>
    </View>
  );
}

export function UsageRing({
  percent,
  size,
  color,
  track,
  stroke = 11,
}: {
  percent: number | null;
  size: number;
  color: string;
  track: string;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circ = 2 * Math.PI * radius;
  const value = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const dash = (value / 100) * circ;
  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
      {value > 0 ? (
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      ) : null}
    </Svg>
  );
}

function MeterCard({
  window,
  now,
  zone,
  colors,
}: {
  window: PresentedWindow;
  now: number;
  zone: string;
  colors: Palette;
}) {
  const styles = makeStyles(colors);
  const percent = Math.max(0, Math.min(100, Math.round(window.displayPercent)));
  const color = barColor(percent, colors);
  return (
    <View style={styles.card}>
      <View style={styles.ringWrap}>
        <UsageRing percent={percent} size={108} color={color} track={colors.track} />
        <View style={styles.ringLabel} pointerEvents="none">
          <Text style={[styles.percent, { color }]}>{percent}%</Text>
        </View>
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{window.label}</Text>
        <Text style={styles.countdown}>
          {window.resetsAt ? formatRemaining(window.resetsAt, now) : 'No reset time reported'}
        </Text>
        {window.sinceResetNote ? <Text style={styles.sinceReset}>{window.sinceResetNote}</Text> : null}
        {window.resetsAt ? <Text style={styles.clock}>{formatWhen(window.resetsAt, zone)} · your time</Text> : null}
      </View>
    </View>
  );
}

function Notice({ colors, tone, text }: { colors: Palette; tone: 'error' | 'warn'; text: string }) {
  const styles = makeStyles(colors);
  return (
    <View style={tone === 'error' ? styles.error : styles.warn}>
      <Text style={tone === 'error' ? styles.errorText : styles.warnText}>{text}</Text>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    loading: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    brand: {
      fontFamily: displayFont,
      fontSize: 36,
      color: colors.text,
      fontWeight: '500',
    },
    headerLink: {
      fontFamily: bodyFont,
      color: colors.accent,
      fontSize: 16,
      fontWeight: '600',
    },
    quiet: {
      fontFamily: bodyFont,
      marginTop: 8,
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    quietCenter: {
      fontFamily: bodyFont,
      marginTop: 8,
      color: colors.muted,
      fontSize: 16,
      lineHeight: 23,
      textAlign: 'center',
    },
    error: {
      backgroundColor: colors.errorBg,
      borderRadius: 16,
      padding: 14,
      marginTop: 16,
    },
    errorText: {
      fontFamily: bodyFont,
      color: colors.errorText,
      fontSize: 15,
      lineHeight: 21,
    },
    warn: {
      backgroundColor: colors.banner,
      borderRadius: 16,
      padding: 14,
      marginTop: 16,
    },
    warnText: {
      fontFamily: bodyFont,
      color: colors.warn,
      fontSize: 15,
      lineHeight: 21,
    },
    empty: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 24,
      padding: 28,
      marginTop: 22,
    },
    emptyTitle: {
      fontFamily: displayFont,
      fontSize: 26,
      color: colors.text,
      marginTop: 14,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 24,
      padding: 16,
      marginTop: 14,
    },
    ringWrap: {
      width: 108,
      height: 108,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringLabel: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    percent: {
      fontFamily: bodyFont,
      fontSize: 22,
      fontWeight: '700',
    },
    cardCopy: {
      flex: 1,
      marginLeft: 8,
    },
    cardTitle: {
      fontFamily: displayFont,
      fontSize: 22,
      color: colors.text,
    },
    countdown: {
      fontFamily: bodyFont,
      marginTop: 6,
      fontSize: 16,
      lineHeight: 22,
      color: colors.text,
    },
    sinceReset: {
      fontFamily: bodyFont,
      marginTop: 4,
      fontSize: 15,
      lineHeight: 20,
      color: colors.accent,
      fontWeight: '600',
    },
    clock: {
      fontFamily: bodyFont,
      marginTop: 4,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    extra: {
      fontFamily: bodyFont,
      marginTop: 16,
      fontSize: 15,
      color: colors.text,
    },
    history: { marginTop: 22 },
    historyTitle: {
      fontFamily: displayFont,
      fontSize: 20,
      color: colors.text,
      marginBottom: 6,
    },
    historyRow: {
      fontFamily: bodyFont,
      fontSize: 14,
      color: colors.muted,
      paddingVertical: 3,
    },
    primary: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 22,
    },
    primaryLabel: {
      fontFamily: bodyFont,
      color: colors.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
    textButton: { paddingVertical: 12, alignItems: 'center' },
    textButtonLabel: {
      fontFamily: bodyFont,
      color: colors.accent,
      fontSize: 15,
    },
  });
}
