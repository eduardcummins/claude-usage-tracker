import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { dark, light } from '../src/theme';

export default function RootLayout() {
  const colors = useColorScheme() === 'dark' ? dark : light;
  return (
    <>
      <StatusBar style={colors === dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </>
  );
}
