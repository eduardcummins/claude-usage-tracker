import { formatWhen, zoneLabel } from './time.js';

const RESET_MOVE_MS = 60 * 1000;

export function previousWindows(state, mode) {
  if (!state || state.mode !== mode || !state.lastSnapshot) return null;
  return state.lastSnapshot.windows || null;
}

export function detectResetWindows(previous, next) {
  if (!previous || !next) return [];
  const prevById = new Map(previous.map((window) => [window.id, window]));
  const found = [];
  for (const window of next) {
    const before = prevById.get(window.id);
    if (!before?.resetsAt || !window.resetsAt) continue;
    const oldMs = Date.parse(before.resetsAt);
    const newMs = Date.parse(window.resetsAt);
    if (!Number.isFinite(oldMs) || !Number.isFinite(newMs)) continue;
    if (newMs > oldMs + RESET_MOVE_MS) found.push(window);
  }
  return found;
}

export function unseenResets(windows, notified) {
  const seen = notified || {};
  return windows.filter((window) => seen[window.id] !== window.resetsAt);
}

export function alertCopy(windows, timeZone = 'Europe/London') {
  const label = zoneLabel(timeZone);
  if (windows.length === 1) {
    const window = windows[0];
    const when = window.resetsAt ? formatWhen(window.resetsAt, timeZone) : 'unknown';
    return {
      title: `${window.label} reset`,
      message: `Your ${window.label} limit has reset. It is now at ${window.usedPercent}%. Next reset: ${when} ${label}.`,
    };
  }
  const lines = windows.map((window) => {
    const when = window.resetsAt ? formatWhen(window.resetsAt, timeZone) : 'unknown';
    return `• ${window.label} — now ${window.usedPercent}%, next reset ${when} ${label}`;
  });
  return {
    title: 'Claude usage limits reset',
    message: `Your Claude usage limits have reset:\n${lines.join('\n')}`,
  };
}
