import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadWidgetCache } from './storage';
import { runSync } from './sync-runner';
import { UsageWidget } from './widget-view';

export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;
  const cache = await loadWidgetCache();
  renderWidget(<UsageWidget cache={cache} />);
  if (widgetAction === 'WIDGET_CLICK') return;
  try {
    await runSync(true);
  } catch {
    // The cached widget is already on screen.
  }
}
