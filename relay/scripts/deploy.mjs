import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'wrangler.jsonc');
const placeholder = '00000000000000000000000000000000';

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN to a Cloudflare API token from the Edit Cloudflare Workers template.');
  process.exit(1);
}

let config = fs.readFileSync(configPath, 'utf8');
if (config.includes(placeholder)) {
  const created = spawnSync('npx', ['wrangler', 'kv', 'namespace', 'create', 'RELAY'], {
    cwd: root,
    encoding: 'utf8',
  });
  const output = `${created.stdout || ''}\n${created.stderr || ''}`;
  if (created.status !== 0) {
    console.error(output);
    process.exit(created.status || 1);
  }
  const id = output.match(/id\s*=\s*"([a-f0-9]{32})"/)?.[1];
  if (!id) {
    console.error(output);
    console.error('Could not read the new KV namespace id.');
    process.exit(1);
  }
  config = config.replaceAll(placeholder, id);
  fs.writeFileSync(configPath, config);
  console.log(`Saved KV namespace ${id} in wrangler.jsonc`);
}

const deployed = spawnSync('npx', ['wrangler', 'deploy'], { cwd: root, stdio: 'inherit' });
process.exit(deployed.status || 0);
