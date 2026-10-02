import { Platform } from 'react-native';

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
  ok: string;
};

export const light: Palette = {
  bg: '#faf9f5',
  card: '#fffcf7',
  text: '#141413',
  muted: '#6b6a64',
  line: '#e7e2d8',
  accent: '#c96442',
  accentText: '#fffdfb',
  track: '#efeae1',
  danger: '#9c3b32',
  warn: '#8a5a12',
  banner: '#f6ebe4',
  errorBg: '#f8e8e4',
  errorText: '#6d1f1f',
  ok: '#0f6e56',
};

export const dark: Palette = {
  bg: '#1f1e1b',
  card: '#2a2926',
  text: '#f7f4ec',
  muted: '#b0aea5',
  line: '#3d3c38',
  accent: '#e08a64',
  accentText: '#1a120e',
  track: '#3a3935',
  danger: '#e07a72',
  warn: '#e0b15a',
  banner: '#3a2e28',
  errorBg: '#3a2422',
  errorText: '#f3c7c2',
  ok: '#7dcea0',
};

export function barColor(percent: number, colors: Palette): string {
  if (percent >= 90) return colors.danger;
  if (percent >= 70) return colors.warn;
  return colors.accent;
}

export const displayFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Liberation Serif", "Noto Serif", Palatino, serif',
});

export const bodyFont = Platform.select({
  android: 'sans-serif',
  default: undefined,
});
