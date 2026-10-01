import path from 'node:path';

export function appPaths(homeDir) {
  const root = path.join(homeDir, '.claude-usage-alert');
  return {
    root,
    config: path.join(root, 'config.json'),
    state: path.join(root, 'state.json'),
    lock: path.join(root, 'run.lock'),
    refreshLock: path.join(root, 'refresh.lock'),
  };
}

export function credentialsPath(homeDir, env = {}) {
  const configured = env.CLAUDE_CONFIG_DIR;
  const base = configured
    ? expandHome(configured, homeDir)
    : path.join(homeDir, '.claude');
  return path.join(base, '.credentials.json');
}

function expandHome(value, homeDir) {
  if (value === '~') return homeDir;
  if (value.startsWith('~/') || value.startsWith('~\\')) return path.join(homeDir, value.slice(2));
  return value;
}
