function asPercent(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function normalizeTime(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  let text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) text += 'Z';
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

const LEGACY = [
  ['five_hour', 'session', '5-hour session', '5h'],
  ['seven_day', 'weekly', 'Weekly (all models)', 'Week'],
  ['seven_day_sonnet', 'weekly:Sonnet', 'Weekly (Sonnet)', 'Sonnet'],
  ['seven_day_opus', 'weekly:Opus', 'Weekly (Opus)', 'Opus'],
];

export function parseUsageResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Usage response was not a JSON object.');
  }
  const fromLimits = parseLimits(body.limits);
  const windows = dedupe(fromLimits.length > 0 ? fromLimits : parseLegacy(body));
  windows.sort(compareWindows);
  return {
    windows,
    extraUsage: parseExtra(body.extra_usage),
  };
}

export function formatPlan(subscriptionType, rateLimitTier) {
  const tier = String(rateLimitTier || '');
  const sub = String(subscriptionType || '');
  if (/20x/i.test(tier)) return 'Max 20x';
  if (/5x/i.test(tier)) return 'Max 5x';
  if (/pro/i.test(sub)) return 'Pro';
  if (/max/i.test(sub)) return 'Max';
  if (/team/i.test(sub)) return 'Team';
  if (/enterprise/i.test(sub)) return 'Enterprise';
  if (sub) return sub;
  return null;
}

function parseLimits(limits) {
  if (!Array.isArray(limits)) return [];
  const windows = [];
  for (const entry of limits) {
    if (!entry || typeof entry !== 'object') continue;
    const percent = asPercent(entry.percent ?? entry.utilization);
    if (percent == null) continue;
    const named = nameLimit(entry);
    windows.push({
      id: named.id,
      label: named.label,
      shortLabel: named.shortLabel,
      usedPercent: percent,
      resetsAt: normalizeTime(entry.resets_at ?? entry.resetsAt),
      severity: typeof entry.severity === 'string' ? entry.severity : null,
    });
  }
  return windows;
}

function nameLimit(entry) {
  const kind = String(entry.kind || '');
  const modelName = modelDisplayName(entry.scope);
  if (kind === 'session' || kind === 'five_hour') {
    return { id: 'session', label: '5-hour session', shortLabel: '5h' };
  }
  if (kind === 'weekly_all' || kind === 'seven_day') {
    return { id: 'weekly', label: 'Weekly (all models)', shortLabel: 'Week' };
  }
  if (modelName) {
    return {
      id: `weekly:${modelName}`,
      label: `Weekly (${modelName})`,
      shortLabel: modelName,
    };
  }
  const id = slug(kind || 'window');
  const label = kind ? kind.replaceAll('_', ' ') : 'Usage window';
  return { id, label, shortLabel: label };
}

function modelDisplayName(scope) {
  const model = scope && scope.model;
  if (!model) return null;
  if (typeof model === 'string' && model.trim()) return model.trim();
  if (typeof model.display_name === 'string' && model.display_name.trim()) {
    return model.display_name.trim();
  }
  return null;
}

function parseLegacy(body) {
  const windows = [];
  for (const [key, id, label, shortLabel] of LEGACY) {
    const entry = body[key];
    if (!entry || typeof entry !== 'object') continue;
    const percent = asPercent(entry.utilization ?? entry.used_percentage ?? entry.percent);
    if (percent == null) continue;
    windows.push({
      id,
      label,
      shortLabel,
      usedPercent: percent,
      resetsAt: normalizeTime(entry.resets_at ?? entry.resetsAt),
      severity: null,
    });
  }
  return windows;
}

function parseExtra(extra) {
  if (!extra || extra.is_enabled !== true) return null;
  const limit = Number(extra.monthly_limit);
  const used = Number(extra.used_credits);
  if (!Number.isFinite(limit) || !Number.isFinite(used)) return null;
  return {
    usedUsd: used / 100,
    limitUsd: limit / 100,
  };
}

function dedupe(windows) {
  const byId = new Map();
  for (const window of windows) byId.set(window.id, window);
  return [...byId.values()];
}

function compareWindows(a, b) {
  return rank(a.id) - rank(b.id) || a.label.localeCompare(b.label);
}

function rank(id) {
  if (id === 'session') return 0;
  if (id === 'weekly') return 1;
  return 2;
}

function slug(value) {
  const text = String(value).trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return text || 'window';
}
