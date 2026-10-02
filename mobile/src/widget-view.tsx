import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formatRemaining } from './model';
import type { WidgetCache } from './storage';

const cream = '#faf9f5';
const ink = '#141413';
const muted = '#6b6a64';
const accent = '#c96442';
const track = '#efeae1';

export function UsageWidget({ cache, now = Date.now() }: { cache: WidgetCache; now?: number }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Plan Pace"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: cream,
        borderRadius: 22,
        padding: 14,
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="Plan Pace" style={{ fontSize: 13, color: muted }} />
        <TextWidget text={cache.plan || ''} style={{ fontSize: 13, color: accent }} />
      </FlexWidget>
      {cache.signedIn ? (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flexGap: 10 }}>
          <Meter label="5-hour" percent={cache.sessionPercent} reset={cache.sessionReset} now={now} />
          <Meter label="Weekly" percent={cache.weeklyPercent} reset={cache.weeklyReset} now={now} />
        </FlexWidget>
      ) : (
        <TextWidget text="Add your topic in Plan Pace." style={{ fontSize: 16, color: ink }} />
      )}
    </FlexWidget>
  );
}

function Meter({
  label,
  percent,
  reset,
  now,
}: {
  label: string;
  percent: number | null;
  reset: string | null;
  now: number;
}) {
  const value = percent == null ? '—' : `${percent}%`;
  const when = reset ? formatRemaining(reset, now) : 'No report yet';
  const used = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flexGap: 3 }}>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text={label} style={{ fontSize: 14, color: ink }} />
        <TextWidget text={value} style={{ fontSize: 20, color: accent }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', height: 7, backgroundColor: track, borderRadius: 8 }}>
        <FlexWidget style={{ flex: Math.max(used, 0.01), height: 7, backgroundColor: used >= 90 ? '#9c3b32' : accent, borderRadius: 8 }} />
        <FlexWidget style={{ flex: Math.max(100 - used, 0.01), height: 7, backgroundColor: track }} />
      </FlexWidget>
      <TextWidget text={when} style={{ fontSize: 12, color: muted }} />
    </FlexWidget>
  );
}
