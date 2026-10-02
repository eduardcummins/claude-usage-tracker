import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { WidgetCache } from './storage';

export async function pushWidget(cache: WidgetCache): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (Constants.executionEnvironment === 'storeClient') return;
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const { UsageWidget } = require('./widget-view') as typeof import('./widget-view');
    const { CompactWidget, RingsWidget } = require('./widget-rings') as typeof import('./widget-rings');
    const names = ['PlanPace', 'CluseCompact', 'CluseBars'] as const;
    for (const widgetName of names) {
      try {
        await requestWidgetUpdate({
          widgetName,
          renderWidget: (info) => {
            const view = (scheme: 'light' | 'dark') => {
              if (widgetName === 'CluseCompact') {
                return CompactWidget({ cache, width: info.width, height: info.height, scheme });
              }
              if (widgetName === 'CluseBars') {
                return UsageWidget({ cache, width: info.width, height: info.height, scheme });
              }
              return RingsWidget({ cache, width: info.width, height: info.height, scheme });
            };
            return { light: view('light'), dark: view('dark') };
          },
        });
      } catch {
        // This size is not on the home screen.
      }
    }
  } catch {
    // No widget on the home screen, or this is a build without the widget module.
  }
}
