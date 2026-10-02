import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { UserError } from './errors.js';
import { assertTopic } from './ntfy.js';
import { appPaths } from './paths.js';

export function newTopic() {
  return `cu-${randomBytes(12).toString('hex')}`;
}

export async function readConfig(homeDir) {
  const file = appPaths(homeDir).config;
  try {
    const text = await fs.readFile(file, 'utf8');
    return normalizeConfig(JSON.parse(text));
  } catch (err) {
    if (err instanceof UserError) throw err;
    if (err && err.code === 'ENOENT') return null;
    throw new UserError(`Could not read the helper config. ${err.message}`);
  }
}

export function normalizeConfig(data) {
  if (!data || typeof data !== 'object') throw new UserError('The helper config is not valid JSON.');
  const server = String(data.ntfyServer || 'https://ntfy.sh').replace(/\/$/, '');
  if (!/^https:\/\//i.test(server)) throw new UserError('ntfyServer in the config must start with https://');
  const topic = String(data.ntfyTopic || '');
  assertTopic(topic);
  return {
    ntfyServer: server,
    ntfyTopic: topic,
    ntfyToken: data.ntfyToken ? String(data.ntfyToken) : '',
    timeZone: data.timeZone || data.timezone || 'Europe/London',
    ntfyKey: normalizeKey(data.ntfyKey),
  };
}

function normalizeKey(value) {
  const key = value ? String(value) : '';
  if (!key) return '';
  if (Buffer.from(key, 'base64url').length !== 32) {
    throw new UserError('The encryption key in the helper config is not valid. Run --init --rotate to pair again.');
  }
  return key;
}

export async function writeConfig(homeDir, config) {
  const file = appPaths(homeDir).config;
  await fs.mkdir(appPaths(homeDir).root, { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(tmp, file);
  await fs.chmod(file, 0o600).catch(() => {});
  return file;
}

export async function requireConfig(homeDir) {
  const config = await readConfig(homeDir);
  if (!config) {
    throw new UserError('No phone topic yet. From the project folder, run: node helper/cli.js --init');
  }
  return config;
}
