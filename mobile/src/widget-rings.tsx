import { FlexWidget, ImageWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { presentPercent, resetCaption } from './model';
import type { WidgetCache } from './storage';
import { barColor, widgetPalettes, type WidgetScheme } from './widget-layout';

export function RingsWidget({
  cache,
  width = 400,
  height = 180,
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
  const ring = Math.max(52, Math.min(78, Math.floor(Math.min(height * 0.42, width / 4.4))));
  const session = presentPercent(cache.sessionPercent, cache.sessionReset, now);
  const weekly = presentPercent(cache.weeklyPercent, cache.weeklyReset, now);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Cluse"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.bg,
        borderRadius: 22,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
        <RingMeter
          label="5-hour"
          percent={session.percent}
          sinceReset={session.sinceReset}
          when={cache.signedIn ? resetCaption(cache.sessionReset, now) : ''}
          size={ring}
          colors={colors}
        />
        <RingMeter
          label="Weekly"
          percent={weekly.percent}
          sinceReset={weekly.sinceReset}
          when={cache.signedIn ? resetCaption(cache.weeklyReset, now) : ''}
          size={ring}
          colors={colors}
        />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
        {cache.signedIn ? (
          <FlexWidget
            clickAction="CHECK_NOW"
            accessibilityLabel="Check now"
            style={{ paddingHorizontal: 12, paddingVertical: 4 }}
          >
            <TextWidget text="Check now" style={{ fontSize: 12, fontWeight: '600', color: colors.accent }} />
          </FlexWidget>
        ) : (
          <TextWidget text="Add your code in Cluse." style={{ fontSize: 12, color: colors.ink }} />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

export function CompactWidget({
  cache,
  width = 180,
  height = 180,
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
  const ring = Math.max(64, Math.min(96, Math.floor(Math.min(width, height) * 0.46)));
  const session = presentPercent(cache.sessionPercent, cache.sessionReset, now);
  const when = resetCaption(cache.sessionReset, now);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Cluse"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.bg,
        borderRadius: 22,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ImageWidget
            image={require('../assets/widget-mark.png')}
            imageWidth={26}
            imageHeight={26}
            style={{ width: 26, height: 26 }}
          />
          <TextWidget text="Cluse" style={{ fontSize: 14, color: colors.ink, marginLeft: 6 }} />
        </FlexWidget>
      </FlexWidget>
      <OverlapWidget style={{ width: ring, height: ring }}>
        <SvgWidget
          svg={ringSvg(session.percent, barColor(session.percent, colors), colors.track)}
          style={{ width: ring, height: ring }}
        />
        <FlexWidget style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget
            text={session.percent == null ? '—' : `${Math.round(session.percent)}%`}
            style={{ fontSize: Math.round(ring * 0.28), fontWeight: '700', color: barColor(session.percent, colors) }}
          />
        </FlexWidget>
      </OverlapWidget>
      <FlexWidget style={{ flexDirection: 'column', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="5-hour" style={{ fontSize: 13, color: colors.ink }} />
        <TextWidget text={when} style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function RingMeter({
  label,
  percent,
  sinceReset,
  when,
  size,
  colors,
}: {
  label: string;
  percent: number | null;
  sinceReset: boolean;
  when: string;
  size: number;
  colors: (typeof widgetPalettes)['light'];
}) {
  const color = barColor(percent, colors);
  return (
    <FlexWidget style={{ flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <OverlapWidget style={{ width: size, height: size }}>
        <SvgWidget svg={ringSvg(percent, color, colors.track)} style={{ width: size, height: size }} />
        <FlexWidget style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget
            text={percent == null ? '—' : `${Math.round(percent)}%`}
            style={{ fontSize: Math.round(size * 0.26), fontWeight: '700', color }}
          />
        </FlexWidget>
      </OverlapWidget>
      <TextWidget text={label} style={{ fontSize: 12, color: colors.ink, marginTop: 4 }} />
      {when ? (
        <TextWidget text={when} style={{ fontSize: 11, color: colors.muted, marginTop: 1 }} />
      ) : sinceReset ? (
        <TextWidget text="since reset" style={{ fontSize: 11, color: colors.muted, marginTop: 1 }} />
      ) : null}
    </FlexWidget>
  );
}

export function ringSvg(percent: number | null, color: string, track: string): string {
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const value = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const dash = (value / 100) * circ;
  const arc =
    value > 0
      ? `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" transform="rotate(-90 50 50)"/>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="${radius}" fill="none" stroke="${track}" stroke-width="8"/>${arc}</svg>`;
}

