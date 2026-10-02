import { ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { HelpBody } from '../src/help-view';
import { dark, light } from '../src/theme';

export default function HelpScreen() {
  const colors = useColorScheme() === 'dark' ? dark : light;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <HelpBody colors={colors} onBack={() => router.back()} />
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
});
