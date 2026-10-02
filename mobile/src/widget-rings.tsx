import { FlexWidget, ImageWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { deviceTimeZone, presentPercent, resetCaption } from './model';
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
  const lines = recentLines(cache, 2);
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
        borderWidth: 1,
        borderColor: colors.accent,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-around' }}>
        <RingMeter
          label="5-hour"
          percent={session.percent}
          sinceReset={session.sinceReset}
          size={ring}
          colors={colors}
        />
        <RingMeter
          label="Weekly"
          percent={weekly.percent}
          sinceReset={weekly.sinceReset}
          size={ring}
          colors={colors}
        />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
          <TextWidget text="Recent checks" style={{ fontSize: 11, color: colors.muted }} />
          {cache.signedIn && lines.length > 0 ? (
            lines.map((line) => (
              <TextWidget key={line} text={line} style={{ fontSize: 11, color: colors.ink, marginTop: 2 }} />
            ))
          ) : (
            <TextWidget text={cache.signedIn ? 'No checks yet' : 'Add your code in Cluse.'} style={{ fontSize: 12, color: colors.ink, marginTop: 2 }} />
          )}
        </FlexWidget>
        <FlexWidget
          clickAction="CHECK_NOW"
          accessibilityLabel="Check now"
          style={{
            backgroundColor: colors.accent,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 7,
            marginLeft: 8,
          }}
        >
          <TextWidget text="Check now" style={{ fontSize: 12, fontWeight: '700', color: '#fffdfb' }} />
        </FlexWidget>
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
  const plan = cache.plan || '';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Cluse"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.bg,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.accent,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center', justifyContent: 'space-between' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ImageWidget
            image={require('../assets/widget-mark.png')}
            imageWidth={26}
            imageHeight={26}
            style={{ width: 26, height: 26 }}
          />
          <TextWidget text="Cluse" style={{ fontSize: 14, color: colors.ink, marginLeft: 6 }} />
        </FlexWidget>
        {plan ? (
          <FlexWidget style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
            <TextWidget text={plan} style={{ fontSize: 11, fontWeight: '700', color: '#fffdfb' }} />
          </FlexWidget>
        ) : null}
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
  size,
  colors,
}: {
  label: string;
  percent: number | null;
  sinceReset: boolean;
  size: number;
  colors: (typeof widgetPalettes)['light'];
}) {
  const color = barColor(percent, colors);
  return (
    <FlexWidget style={{ flexDirection: 'column', alignItems: 'center' }}>
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
      {sinceReset ? <TextWidget text="since reset" style={{ fontSize: 11, color: colors.muted, marginTop: 1 }} /> : null}
    </FlexWidget>
  );
}

function recentLines(cache: WidgetCache, limit: number): string[] {
  const zone = deviceTimeZone();
  return [...cache.recent].slice(-limit).reverse().map((point) => {
    const clock = clockLabel(point.t, zone);
    const bits = [
      point.session == null ? '' : `5h ${Math.round(point.session)}%`,
      point.weekly == null ? '' : `Week ${Math.round(point.weekly)}%`,
    ].filter(Boolean);
    return `${clock}  ${bits.join('  ')}`;
  });
}

function clockLabel(iso: string, zone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  } catch {
    return '';
  }
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

