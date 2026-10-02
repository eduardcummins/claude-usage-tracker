import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function registerAndroidWidget(): void {
  if (Platform.OS !== 'android') return;
  if (Constants.executionEnvironment === 'storeClient') return;
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const { widgetTaskHandler } = require('./widget-task-handler') as typeof import('./widget-task-handler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // Expo Go does not include the Android widget module.
  }
}
