export const LOGIN_WAIT_NOTICE = 'waiting for Claude Code login';

export function waitingSnapshot({ now, timeZone, lastSnapshot, history }) {
  const fetchedAt = lastSnapshot?.fetchedAt || new Date(now).toISOString();
  return {
    v: 1,
    type: 'snapshot',
    status: 'waiting-login',
    notice: LOGIN_WAIT_NOTICE,
    fetchedAt,
    checkedAt: new Date(now).toISOString(),
    plan: lastSnapshot?.plan || null,
    timeZone: timeZone || 'Europe/London',
    windows: Array.isArray(lastSnapshot?.windows) ? lastSnapshot.windows : [],
    extraUsageLabel: lastSnapshot?.extraUsageLabel || null,
    recent: Array.isArray(history) ? history.slice(-18) : [],
  };
}

export function buildSnapshot({ fetchedAt, plan, timeZone, parsed, history }) {
  const windows = parsed.windows;
  const point = compactPoint(fetchedAt, windows);
  const recent = [...history, point].slice(-18);
  const extra = parsed.extraUsage;
  return {
    snapshot: {
      v: 1,
      type: 'snapshot',
      fetchedAt,
      plan: plan || null,
      timeZone: timeZone || 'Europe/London',
      windows,
      extraUsageLabel: extra
        ? `Extra usage: $${extra.usedUsd.toFixed(2)} of $${extra.limitUsd.toFixed(2)}`
        : null,
      recent,
    },
    point,
  };
}

export function compactPoint(fetchedAt, windows) {
  const w = {};
  for (const window of windows) w[window.id] = window.usedPercent;
  return { t: fetchedAt, w };
}

export function fitSnapshot(snapshot) {
  let current = snapshot;
  while (JSON.stringify(current).length > 3500 && current.recent.length > 1) {
    current = { ...current, recent: current.recent.slice(1) };
  }
  return current;
}
