import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { WidgetCache } from './storage';

export async function pushWidget(cache: WidgetCache): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (Constants.executionEnvironment === 'storeClient') return;
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const { UsageWidget } = require('./widget-view') as typeof import('./widget-view');
    await requestWidgetUpdate({
      widgetName: 'PlanPace',
      renderWidget: (info) => ({
        light: UsageWidget({ cache, width: info.width, height: info.height, scheme: 'light' }),
        dark: UsageWidget({ cache, width: info.width, height: info.height, scheme: 'dark' }),
      }),
    });
  } catch {
    // No widget on the home screen, or this is a build without the widget module.
  }
}
