import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { presentPercent, resetCaption } from './model';
import type { WidgetCache } from './storage';
import {
  barColor,
  barSegments,
  widgetMetrics,
  widgetPalettes,
  type WidgetScheme,
} from './widget-layout';

export function UsageWidget({
  cache,
  width = 320,
  height = 140,
  scheme = 'light',
  now = Date.now(),
}: {
  cache: WidgetCache;
  width?: number;
  height?: number;
  scheme?: WidgetScheme;
  now?: number;
}) {
  const colors = widgetPalettes[scheme];
  const metrics = widgetMetrics(width, height);
  const inner = Math.max(48, width - metrics.padX * 2);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Cluse"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.bg,
        borderRadius: metrics.radius,
        paddingHorizontal: metrics.padX,
        paddingVertical: metrics.padY,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TextWidget text="Cluse" style={{ fontSize: metrics.title, color: colors.muted }} />
      </FlexWidget>
      {cache.signedIn ? (
        <FlexWidget
          style={{
            flexDirection: 'column',
            width: 'match_parent',
            flex: 1,
            justifyContent: 'space-evenly',
          }}
        >
          <Meter
            label="5-hour"
            percent={presentPercent(cache.sessionPercent, cache.sessionReset, now).percent}
            when={resetCaption(cache.sessionReset, now)}
            inner={inner}
            metrics={metrics}
            colors={colors}
          />
          <Meter
            label="Weekly"
            percent={presentPercent(cache.weeklyPercent, cache.weeklyReset, now).percent}
            when={resetCaption(cache.weeklyReset, now)}
            inner={inner}
            metrics={metrics}
            colors={colors}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flex: 1, justifyContent: 'center', width: 'match_parent' }}>
          <TextWidget text="Add your topic in Cluse." style={{ fontSize: metrics.label, color: colors.ink }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

function Meter({
  label,
  percent,
  when,
  inner,
  metrics,
  colors,
}: {
  label: string;
  percent: number | null;
  when: string;
  inner: number;
  metrics: ReturnType<typeof widgetMetrics>;
  colors: (typeof widgetPalettes)['light'];
}) {
  const color = barColor(percent, colors);
  const parts = barSegments(inner, percent, metrics.thumb);
  const left = Math.round(parts.left);
  const marker = parts.showMarker ? metrics.thumb : 0;
  const right = Math.max(0, inner - left - marker);
  const value = percent == null ? '—' : `${Math.round(percent)}%`;
  const empty = percent == null;
  return (
    <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TextWidget text={label} style={{ fontSize: metrics.label, color: colors.ink }} />
        <TextWidget
          text={value}
          style={{ fontSize: metrics.percent, fontWeight: '700', color: empty ? colors.muted : color }}
        />
      </FlexWidget>
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: inner,
          height: metrics.thumb,
          alignItems: 'center',
          marginTop: 5,
        }}
      >
        {left > 0 ? (
          <FlexWidget
            style={{
              width: left,
              height: metrics.bar,
              backgroundColor: color,
              borderTopLeftRadius: metrics.bar,
              borderBottomLeftRadius: metrics.bar,
            }}
          />
        ) : null}
        {parts.showMarker ? (
          <FlexWidget
            style={{
              width: metrics.thumb,
              height: metrics.thumb,
              borderRadius: metrics.thumb / 2,
              backgroundColor: color,
              borderWidth: 2,
              borderColor: colors.bg,
            }}
          />
        ) : null}
        {right > 0 ? (
          <FlexWidget
            style={{
              width: right,
              height: metrics.bar,
              backgroundColor: colors.track,
              borderTopRightRadius: metrics.bar,
              borderBottomRightRadius: metrics.bar,
              borderTopLeftRadius: left === 0 && !parts.showMarker ? metrics.bar : 0,
              borderBottomLeftRadius: left === 0 && !parts.showMarker ? metrics.bar : 0,
            }}
          />
        ) : null}
      </FlexWidget>
      <TextWidget text={when} style={{ fontSize: metrics.meta, color: colors.muted, marginTop: 4 }} />
    </FlexWidget>
  );
}
