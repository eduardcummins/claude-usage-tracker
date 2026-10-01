export type Palette = {
  bg: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  accentText: string;
  track: string;
  danger: string;
  warn: string;
  banner: string;
  errorBg: string;
  errorText: string;
};

export const light: Palette = {
  bg: '#faf9f5',
  card: '#ffffff',
  text: '#141413',
  muted: '#6b6a64',
  line: '#e7e2d8',
  accent: '#c96442',
  accentText: '#ffffff',
  track: '#efeae1',
  danger: '#a33b32',
  warn: '#8a5a12',
  banner: '#f3e6df',
  errorBg: '#f8e6e4',
  errorText: '#6d1f1f',
};

export const dark: Palette = {
  bg: '#262624',
  card: '#30302e',
  text: '#faf9f5',
  muted: '#b0aea5',
  line: '#3d3d3a',
  accent: '#e08a64',
  accentText: '#1a120e',
  track: '#3d3d3a',
  danger: '#e07a72',
  warn: '#e0b15a',
  banner: '#3a2e28',
  errorBg: '#3a2422',
  errorText: '#f3c7c2',
};

export function barColor(percent: number, colors: Palette): string {
  if (percent >= 90) return colors.danger;
  if (percent >= 70) return colors.warn;
  return colors.accent;
}
