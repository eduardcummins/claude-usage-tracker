export type WidgetScheme = 'light' | 'dark';

type Hex = `#${string}`;

export type WidgetPalette = {
  bg: Hex;
  ink: Hex;
  muted: Hex;
  accent: Hex;
  track: Hex;
  danger: Hex;
};

export type WidgetMetrics = {
  padX: number;
  padY: number;
  title: number;
  label: number;
  percent: number;
  meta: number;
  bar: number;
  thumb: number;
  gap: number;
  radius: number;
};

export const widgetPalettes: Record<WidgetScheme, WidgetPalette> = {
  light: {
    bg: '#faf9f5',
    ink: '#141413',
    muted: '#6b6a64',
    accent: '#c96442',
    track: '#e6e0d6',
    danger: '#9c3b32',
  },
  dark: {
    bg: '#1f1e1b',
    ink: '#f7f4ec',
    muted: '#b0aea5',
    accent: '#e08a64',
    track: '#3a3935',
    danger: '#e07a72',
  },
};

export function widgetMetrics(width: number, height: number): WidgetMetrics {
  const short = height < 170;
  const narrow = width < 300;
  return {
    padX: narrow ? 14 : 18,
    padY: short ? 10 : 16,
    title: short ? 11 : 13,
    label: short || narrow ? 13 : 15,
    percent: short ? 15 : 18,
    meta: short ? 11 : 12,
    bar: short ? 6 : 8,
    thumb: short ? 12 : 16,
    gap: short ? 6 : 10,
    radius: 20,
  };
}

export function barColor(percent: number | null, colors: WidgetPalette): Hex {
  if (percent != null && percent >= 90) return colors.danger;
  return colors.accent;
}

/** Center of the marker, kept fully on the bar. */
export function markerCenter(barWidth: number, percent: number | null, thumb: number): number {
  const value = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const radius = thumb / 2;
  const raw = (barWidth * value) / 100;
  if (barWidth <= thumb) return barWidth / 2;
  return Math.max(radius, Math.min(barWidth - radius, raw));
}

export function barSegments(barWidth: number, percent: number | null, thumb: number): {
  center: number;
  left: number;
  right: number;
  showMarker: boolean;
} {
  if (percent == null) {
    return { center: 0, left: 0, right: barWidth, showMarker: false };
  }
  const center = markerCenter(barWidth, percent, thumb);
  return {
    center,
    left: Math.max(0, center - thumb / 2),
    right: Math.max(0, barWidth - center - thumb / 2),
    showMarker: true,
  };
}
