export function expiryMs(expiresAt) {
  const n = Number(expiresAt);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? n * 1000 : n;
}

export function tokenStillValid(expiresAt, now, skewMs = 120000) {
  const ms = expiryMs(expiresAt);
  if (ms == null) return true;
  return ms - now > skewMs;
}

export function formatWhen(iso, timeZone = 'Europe/London') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const zone = safeZone(timeZone);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return formatted;
}

export function zoneLabel(timeZone = 'Europe/London') {
  return safeZone(timeZone) === 'Europe/London' ? 'UK time' : safeZone(timeZone);
}

export function formatRemaining(iso, now) {
  const ms = Date.parse(iso) - now;
  if (!Number.isFinite(ms)) return 'reset time unknown';
  if (ms <= 0) return `reset ${formatDuration(-ms)} ago`;
  return `resets in ${formatDuration(ms)}`;
}

export function formatDuration(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return 'less than a minute';
  const days = Math.floor(mins / (60 * 24));
  const hours = Math.floor((mins % (60 * 24)) / 60);
  const minutes = mins % 60;
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

export function describeWindow(win, now, timeZone = 'Europe/London') {
  const rel = win.resetsAt ? formatRemaining(win.resetsAt, now) : 'reset time unknown';
  const when = win.resetsAt ? formatWhen(win.resetsAt, timeZone) : 'no reset time reported';
  return `${win.label}: ${win.usedPercent}% used, ${rel} (${when} ${zoneLabel(timeZone)})`;
}

function safeZone(timeZone) {
  try {
    Intl.DateTimeFormat('en-GB', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'Europe/London';
  }
}
