import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadWidgetCache } from './storage';
import { runSync } from './sync-runner';
import { UsageWidget } from './widget-view';

export async function widgetTaskHandler({
  widgetAction,
  widgetInfo,
  renderWidget,
}: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;
  const cache = await loadWidgetCache();
  renderWidget({
    light: <UsageWidget cache={cache} width={widgetInfo.width} height={widgetInfo.height} scheme="light" />,
    dark: <UsageWidget cache={cache} width={widgetInfo.width} height={widgetInfo.height} scheme="dark" />,
  });
  if (widgetAction === 'WIDGET_CLICK') return;
  try {
    await runSync(true);
  } catch {
    // The cached widget is already on screen.
  }
}
