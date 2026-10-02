import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bodyFont, displayFont, Palette } from './theme';

const ITEMS = [
  {
    title: 'What the phone stores',
    body: 'The topic you paste, the latest percentages, and the reset alarms. There is no Claude login on this phone. Chats and files are not read.',
  },
  {
    title: 'The install command failed',
    body: 'Install Node.js 20 or newer from nodejs.org, then run the command again. If the download says it was not found, the project files are not public yet. The command has to be able to reach the GitHub project.',
  },
  {
    title: 'No report yet',
    body: 'The computer sends one about every 10 minutes, and only while it is awake and Claude Code is signed in. Run the helper once, then tap Check now.',
  },
  {
    title: 'The numbers look old',
    body: 'The last report is more than about 30 minutes old. The computer may be asleep. The last percentages stay on screen. Wake the computer and open Cluse again.',
  },
  {
    title: 'I pasted the topic and the meters stayed empty',
    body: 'Paste the phone topic, not a longer address, unless the address is the ntfy link the helper printed. A topic ending in -data is accepted. The app reads the usage messages itself.',
  },
  {
    title: 'A reset time passed and the phone stayed quiet',
    body: 'Allow notifications for Cluse. On Android 12 or newer, also allow Alarms & reminders. Open the app once so it can set the alarms again.',
  },
  {
    title: 'The home screen widget is empty',
    body: 'Open Cluse until the meters appear, then add the widget. Long-press the home screen, tap Widgets, and choose Cluse.',
  },
  {
    title: 'Scanning did not work',
    body: 'The camera is used only to read the QR code. The picture is not saved. If the code in the terminal is too small, open the topic.html file the helper saved and scan that, or paste the topic.',
  },
];

export function HelpBody({ colors, onBack }: { colors: Palette; onBack: () => void }) {
  const styles = makeStyles(colors);
  return (
    <View>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Help</Text>
      <Text style={styles.lede}>
        Cluse reads a usage report from your own computer. It does not sign in to Claude on this phone.
      </Text>
      {ITEMS.map((item) => (
        <View key={item.title} style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      ))}
      <Text style={styles.footer}>Cluse is not affiliated with Anthropic.</Text>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    back: {
      fontFamily: bodyFont,
      color: colors.accent,
      fontSize: 16,
      fontWeight: '600',
      marginTop: 8,
    },
    title: {
      fontFamily: displayFont,
      fontSize: 36,
      color: colors.text,
      marginTop: 12,
      fontWeight: '500',
    },
    lede: {
      fontFamily: bodyFont,
      fontSize: 17,
      lineHeight: 25,
      color: colors.text,
      marginTop: 10,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 20,
      padding: 16,
      marginTop: 12,
    },
    cardTitle: {
      fontFamily: displayFont,
      fontSize: 20,
      color: colors.text,
    },
    body: {
      fontFamily: bodyFont,
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
      marginTop: 6,
    },
    footer: {
      fontFamily: bodyFont,
      color: colors.muted,
      fontSize: 13,
      marginTop: 22,
    },
  });
}
