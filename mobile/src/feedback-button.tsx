import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { FEEDBACK_EMAIL, FEEDBACK_URL } from './feedback';
import { bodyFont, Palette } from './theme';

export function FeedbackButton({ colors }: { colors: Palette }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Send feedback by email"
      style={[styles.button, { borderColor: colors.line, backgroundColor: colors.card }]}
      onPress={() => void Linking.openURL(FEEDBACK_URL).catch(() => undefined)}
    >
      <Text style={[styles.label, { color: colors.text }]}>Send feedback</Text>
      <Text style={[styles.meta, { color: colors.muted }]}>{FEEDBACK_EMAIL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  label: {
    fontFamily: bodyFont,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontFamily: bodyFont,
    fontSize: 13,
    marginTop: 2,
  },
});
