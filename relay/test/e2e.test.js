import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { main } from '../../helper/lib/main.js';
import { appPaths } from '../../helper/lib/paths.js';
import { encodePairing } from '../../helper/lib/pairing.js';
import { decodePairing } from '../../mobile/src/pairing.ts';
import { fetchRelaySnapshot } from '../../mobile/src/relay.ts';

const relayRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the helper publishes to the local relay and the phone decrypts it', async () => {
  const mf = new Miniflare({
    modules: true,
    scriptPath: path.join(relayRoot, 'src/index.js'),
    kvNamespaces: ['RELAY'],
  });
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'cluse-relay-'));
  const origin = 'http://127.0.0.1:8787';
  try {
    const fetchImpl = async (url, options = {}) => {
      const target = String(url);
      if (target.startsWith(origin)) return mf.dispatchFetch(target, options);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => '{}',
      };
    };
    const logs = [];
    const deps = {
      homeDir: home,
      platform: 'linux',
      env: { CLUSE_RELAY_URL: origin },
      now: Date.parse('2026-10-02T10:00:00Z'),
      log: (line) => logs.push(String(line)),
      error: () => {},
      fetch: fetchImpl,
    };
    assert.equal(await main(['--init'], deps), 0);
    const config = JSON.parse(await fs.readFile(appPaths(home).config, 'utf8'));
    assert.equal(config.relay.url, origin);
    assert.match(config.ntfyTopic, /^cu-/);
    const code = encodePairing({ url: config.relay.url, deviceId: config.relay.deviceId, key: config.relay.key });
    assert.equal(logs.some((line) => line === code), true);
    assert.equal(code.includes(config.relay.writeSecret), false);

    assert.equal(await main(['--mock', '--scenario', 'before'], deps), 0);
    const link = decodePairing(code);
    const snapshot = await fetchRelaySnapshot(fetchImpl, link);
    assert.equal(snapshot.plan, 'Sample');
    assert.equal(snapshot.windows.find((window) => window.id === 'session').usedPercent, 86);
    assert.equal(snapshot.windows.find((window) => window.id === 'weekly').usedPercent, 22);

    const raw = await mf.dispatchFetch(`${origin}/v1/devices/${config.relay.deviceId}`);
    const stored = await raw.json();
    assert.equal(JSON.stringify(stored).includes('Sample'), false);
    assert.equal(JSON.stringify(stored).includes('86'), false);
  } finally {
    await mf.dispose();
  }
});
