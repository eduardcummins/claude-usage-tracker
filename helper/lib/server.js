import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function defaultNtfyServer(env = process.env) {
  const fromEnv = String(env.NTFY_SERVER || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ntfy.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return String(parsed.url || 'https://ntfy.sh').replace(/\/$/, '');
}
