import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { installCommand, type ComputerKind } from './install-commands';
import { bodyFont, displayFont, Palette } from './theme';

const STEPS = ['About', 'Computer', 'Topic'];

export function SetupFlow({
  colors,
  step,
  computer,
  topic,
  copied,
  busy,
  error,
  onComputer,
  onTopic,
  onCopy,
  onScan,
  onBack,
  onNext,
  onSave,
  onHelp,
}: {
  colors: Palette;
  step: number;
  computer: ComputerKind;
  topic: string;
  copied: boolean;
  busy: string;
  error: string;
  onComputer: (kind: ComputerKind) => void;
  onTopic: (value: string) => void;
  onCopy: () => void;
  onScan: () => void;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
  onHelp: () => void;
}) {
  const styles = makeStyles(colors);
  const command = installCommand(computer);
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.brand}>Cluse</Text>
        <Pressable onPress={onHelp} hitSlop={12}>
          <Text style={styles.headerLink}>Help</Text>
        </Pressable>
      </View>
      <View style={styles.dots}>
        {STEPS.map((label, index) => (
          <View key={label} style={styles.dotItem}>
            <View style={[styles.dot, index <= step ? styles.dotOn : null]} />
            <Text style={[styles.dotLabel, index === step ? styles.dotLabelOn : null]}>{label}</Text>
          </View>
        ))}
      </View>

      {step === 0 ? (
        <View>
          <Text style={styles.title}>Your plan, on your phone</Text>
          <Text style={styles.lede}>
            Cluse shows how much of the 5-hour session and the weekly limit is used, and when each one resets.
          </Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No Claude login on this phone</Text>
            <Text style={styles.body}>
              A small helper on your computer reads the plan you already use there. This phone only receives the
              percentages. It does not see chats or files.
            </Text>
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <View>
          <Text style={styles.title}>Install the helper</Text>
          <Text style={styles.lede}>On the computer where you use the plan, copy one command and run it.</Text>
          <View style={styles.segment}>
            <Pressable
              style={[styles.segmentItem, computer === 'mac' ? styles.segmentOn : null]}
              onPress={() => onComputer('mac')}
            >
              <Text style={[styles.segmentLabel, computer === 'mac' ? styles.segmentLabelOn : null]}>Mac</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentItem, computer === 'windows' ? styles.segmentOn : null]}
              onPress={() => onComputer('windows')}
            >
              <Text style={[styles.segmentLabel, computer === 'windows' ? styles.segmentLabelOn : null]}>Windows</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>{computer === 'mac' ? 'Terminal' : 'PowerShell'}</Text>
          <Text selectable style={styles.command}>
            {command}
          </Text>
          <Pressable style={styles.secondary} onPress={onCopy}>
            <Text style={styles.secondaryLabel}>{copied ? 'Copied' : 'Copy command'}</Text>
          </Pressable>
          <Text style={styles.note}>
            Node.js 20 or newer is required. The command downloads the helper, checks about every 10 minutes, and
            prints a topic plus a QR code. Leave the computer awake.
          </Text>
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text style={styles.title}>Add the code</Text>
          <Text style={styles.lede}>
            Paste the pairing code, or scan the QR code. A topic that starts with cu- still works.
          </Text>
          <Text style={styles.hint}>Pairing code</Text>
          <TextInput
            value={topic}
            onChangeText={onTopic}
            autoCapitalize="none"
            autoCorrect={false}
            nativeID="planpace-topic"
            placeholder="Paste the code"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable style={styles.primary} onPress={onSave} disabled={busy !== '' || topic.trim() === ''}>
            <Text style={styles.primaryLabel}>{busy === 'save' ? 'Saving…' : 'Save'}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onScan}>
            <Text style={styles.secondaryLabel}>Scan QR code</Text>
          </Pressable>
          <Text style={styles.note}>
            A pairing code is the encryption key. ntfy only sees the encrypted report. A plain cu- topic is still a password for the percentages.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {step > 0 ? (
          <Pressable style={styles.textButton} onPress={onBack}>
            <Text style={styles.textButtonLabel}>Back</Text>
          </Pressable>
        ) : null}
        {step < 2 ? (
          <Pressable style={styles.primary} onPress={onNext}>
            <Text style={styles.primaryLabel}>{step === 1 ? 'I have the topic' : 'Continue'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    brand: {
      fontFamily: displayFont,
      fontSize: 28,
      color: colors.text,
      fontWeight: '500',
    },
    headerLink: {
      fontFamily: bodyFont,
      color: colors.accent,
      fontSize: 16,
      fontWeight: '600',
    },
    dots: {
      flexDirection: 'row',
      marginTop: 22,
      gap: 16,
    },
    dotItem: { flexDirection: 'row', alignItems: 'center' },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 8,
      backgroundColor: colors.line,
      marginRight: 6,
    },
    dotOn: { backgroundColor: colors.accent },
    dotLabel: { fontFamily: bodyFont, color: colors.muted, fontSize: 13 },
    dotLabelOn: { color: colors.text, fontWeight: '600' },
    title: {
      fontFamily: displayFont,
      fontSize: 34,
      lineHeight: 40,
      color: colors.text,
      marginTop: 22,
      fontWeight: '500',
    },
    lede: {
      fontFamily: bodyFont,
      fontSize: 17,
      lineHeight: 25,
      color: colors.text,
      marginTop: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 22,
      padding: 18,
      marginTop: 18,
    },
    cardTitle: {
      fontFamily: displayFont,
      fontSize: 22,
      color: colors.text,
    },
    body: {
      fontFamily: bodyFont,
      fontSize: 16,
      lineHeight: 23,
      color: colors.text,
      marginTop: 8,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.track,
      borderRadius: 14,
      padding: 4,
      marginTop: 18,
    },
    segmentItem: {
      flex: 1,
      borderRadius: 11,
      paddingVertical: 10,
      alignItems: 'center',
    },
    segmentOn: { backgroundColor: colors.card },
    segmentLabel: { fontFamily: bodyFont, color: colors.muted, fontSize: 15, fontWeight: '600' },
    segmentLabelOn: { color: colors.text },
    hint: {
      fontFamily: bodyFont,
      color: colors.muted,
      fontSize: 13,
      marginTop: 16,
      marginBottom: 6,
    },
    command: {
      fontFamily: PlatformMono,
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
    },
    input: {
      fontFamily: bodyFont,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
    },
    note: {
      fontFamily: bodyFont,
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 14,
    },
    primary: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    primaryLabel: {
      fontFamily: bodyFont,
      color: colors.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
    secondary: {
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
    },
    secondaryLabel: {
      fontFamily: bodyFont,
      color: colors.accent,
      fontSize: 16,
      fontWeight: '600',
    },
    error: {
      fontFamily: bodyFont,
      backgroundColor: colors.errorBg,
      color: colors.errorText,
      padding: 14,
      borderRadius: 16,
      marginTop: 16,
      fontSize: 15,
      lineHeight: 21,
    },
    actions: { marginTop: 8 },
    textButton: { paddingVertical: 12, alignItems: 'center' },
    textButtonLabel: { fontFamily: bodyFont, color: colors.accent, fontSize: 15 },
  });
}

const PlatformMono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
});
