import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formatRemaining } from './model';
import type { WidgetCache } from './storage';

export function UsageWidget({ cache }: { cache: WidgetCache }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Plan Pace"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: '#faf9f5',
        borderRadius: 18,
        padding: 14,
        justifyContent: 'space-between',
      }}
    >
      <TextWidget text="Plan Pace" style={{ fontSize: 13, color: '#6b6a64' }} />
      {cache.signedIn ? (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flexGap: 8 }}>
          <Meter label="5-hour" percent={cache.sessionPercent} reset={cache.sessionReset} />
          <Meter label="Weekly" percent={cache.weeklyPercent} reset={cache.weeklyReset} />
        </FlexWidget>
      ) : (
        <TextWidget
          text="Open Plan Pace and paste your topic."
          style={{ fontSize: 16, color: '#141413' }}
        />
      )}
    </FlexWidget>
  );
}

function Meter({ label, percent, reset }: { label: string; percent: number | null; reset: string | null }) {
  const value = percent == null ? '—' : `${percent}%`;
  const when = reset ? formatRemaining(reset, Date.now()) : 'No report yet';
  return (
    <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', alignItems: 'center' }}>
      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget text={label} style={{ fontSize: 14, color: '#141413' }} />
        <TextWidget text={when} style={{ fontSize: 12, color: '#6b6a64' }} />
      </FlexWidget>
      <TextWidget text={value} style={{ fontSize: 28, fontWeight: 'bold', color: '#c96442' }} />
    </FlexWidget>
  );
}
