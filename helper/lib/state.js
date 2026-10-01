import fs from 'node:fs/promises';
import path from 'node:path';

export function emptyState() {
  return {
    mode: null,
    lastSnapshot: null,
    history: [],
    notifiedResets: {},
    backoffUntil: null,
  };
}

export async function loadState(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') return emptyState();
    return {
      mode: data.mode || null,
      lastSnapshot: data.lastSnapshot || null,
      history: Array.isArray(data.history) ? data.history : [],
      notifiedResets: data.notifiedResets && typeof data.notifiedResets === 'object' ? data.notifiedResets : {},
      backoffUntil: data.backoffUntil || null,
    };
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      return emptyState();
    }
    return emptyState();
  }
}

export async function saveState(file, state) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
  await fs.chmod(file, 0o600).catch(() => {});
}
