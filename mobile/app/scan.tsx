import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { saveTopic } from '../src/sync-runner';
import { bodyFont, displayFont } from '../src/theme';
import { dark, light } from '../src/theme';

export default function ScanScreen() {
  const colors = useColorScheme() === 'dark' ? dark : light;
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const handled = useRef(false);

  async function onScan(data: string) {
    if (handled.current) return;
    handled.current = true;
    try {
      await saveTopic(data);
      router.replace('/');
    } catch (err) {
      handled.current = false;
      setError(err instanceof Error ? err.message : 'That code is not a topic.');
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: colors.accent }]}>Back</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>Scan the topic</Text>
      <Text style={[styles.lede, { color: colors.text }]}>
        Point the camera at the code from the computer. The picture is not saved.
      </Text>
      {!permission ? <View style={styles.camera} /> : null}
      {permission && !permission.granted ? (
        <View style={styles.prompt}>
          <Text style={[styles.lede, { color: colors.text }]}>
            Plan Pace needs the camera for this scan only.
          </Text>
          <Pressable style={[styles.primary, { backgroundColor: colors.accent }]} onPress={() => void requestPermission()}>
            <Text style={[styles.primaryLabel, { color: colors.accentText }]}>Allow camera</Text>
          </Pressable>
        </View>
      ) : null}
      {permission?.granted ? (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => void onScan(data)}
        />
      ) : null}
      {error ? <Text style={[styles.error, { backgroundColor: colors.errorBg, color: colors.errorText }]}>{error}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 22 },
  back: {
    fontFamily: bodyFont,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  title: {
    fontFamily: displayFont,
    fontSize: 34,
    marginTop: 12,
    fontWeight: '500',
  },
  lede: {
    fontFamily: bodyFont,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
  },
  prompt: { marginTop: 24 },
  camera: {
    flex: 1,
    marginTop: 18,
    marginBottom: 18,
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: 280,
  },
  primary: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryLabel: {
    fontFamily: bodyFont,
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    fontFamily: bodyFont,
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 21,
  },
});
