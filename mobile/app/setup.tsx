import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { installCommand, type ComputerKind } from '../src/install-commands';
import { saveTopic } from '../src/sync-runner';
import { SetupFlow } from '../src/setup-view';
import { dark, light } from '../src/theme';

export default function SetupScreen() {
  const colors = useColorScheme() === 'dark' ? dark : light;
  const params = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState(params.step === 'topic' ? 2 : 0);
  const [computer, setComputer] = useState<ComputerKind>('mac');
  const [topic, setTopic] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function copy() {
    await Clipboard.setStringAsync(installCommand(computer));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function save() {
    setBusy('save');
    setError('');
    try {
      await saveTopic(topic);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the topic.');
    } finally {
      setBusy('');
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <SetupFlow
            colors={colors}
            step={step}
            computer={computer}
            topic={topic}
            copied={copied}
            busy={busy}
            error={error}
            onComputer={(kind) => {
              setComputer(kind);
              setCopied(false);
            }}
            onTopic={setTopic}
            onCopy={() => void copy()}
            onScan={() => router.push('/scan')}
            onBack={() => {
              setError('');
              setStep((current) => Math.max(0, current - 1));
            }}
            onNext={() => {
              setError('');
              setStep((current) => Math.min(2, current + 1));
            }}
            onSave={() => void save()}
            onHelp={() => router.push('/help')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  page: {
    paddingHorizontal: 22,
    paddingBottom: 36,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
