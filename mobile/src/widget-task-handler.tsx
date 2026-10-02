import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadWidgetCache } from './storage';
import { runSync } from './sync-runner';
import { CompactWidget, RingsWidget } from './widget-rings';
import { UsageWidget } from './widget-view';

export async function widgetTaskHandler({
  widgetAction,
  widgetInfo,
  clickAction,
  renderWidget,
}: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;
  const draw = async () => {
    const cache = await loadWidgetCache();
    const view = (scheme: 'light' | 'dark') => widgetView(widgetInfo.widgetName, cache, widgetInfo.width, widgetInfo.height, scheme);
    renderWidget({ light: view('light'), dark: view('dark') });
  };
  await draw();
  if (widgetAction === 'WIDGET_CLICK' && clickAction !== 'CHECK_NOW') return;
  try {
    await runSync(true);
    if (clickAction === 'CHECK_NOW') await draw();
  } catch {
    // The cached widget is already on screen.
  }
}

function widgetView(
  name: string,
  cache: Awaited<ReturnType<typeof loadWidgetCache>>,
  width: number,
  height: number,
  scheme: 'light' | 'dark',
) {
  if (name === 'CluseCompact') return <CompactWidget cache={cache} width={width} height={height} scheme={scheme} />;
  if (name === 'CluseBars') return <UsageWidget cache={cache} width={width} height={height} scheme={scheme} />;
  return <RingsWidget cache={cache} width={width} height={height} scheme={scheme} />;
}
