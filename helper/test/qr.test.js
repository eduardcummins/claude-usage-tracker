import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { encode } from '../vendor/uqr/index.mjs';
import { renderTopicQr, writeTopicPage } from '../lib/qr.js';

test('the topic QR is a scannable code and the page keeps the topic on disk', async () => {
  const topic = 'cu-exampletopic';
  const qr = renderTopicQr(topic);
  assert.match(qr.html, new RegExp(topic));
  assert.match(qr.svg, /<svg/);
  assert.match(qr.terminal, /\u001B\[40m/);

  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'plan-pace-qr-'));
  const page = await writeTopicPage(home, topic);
  const saved = await fs.readFile(page.file, 'utf8');
  assert.match(saved, new RegExp(topic));

  const zbar = spawnSync('zbarimg', ['--version'], { encoding: 'utf8' });
  if (zbar.error || zbar.status !== 0) return;
  const file = path.join(home, 'topic.pbm');
  await fs.writeFile(file, pbm(topic));
  const scan = spawnSync('zbarimg', ['--quiet', '--raw', file], { encoding: 'utf8' });
  assert.equal(scan.status, 0);
  assert.equal(scan.stdout.trim(), topic);
});

function pbm(topic) {
  const qr = encode(topic, { ecc: 'M', border: 2 });
  const scale = 8;
  const size = qr.size * scale;
  const rows = [];
  for (let y = 0; y < qr.size; y += 1) {
    const line = [];
    for (let x = 0; x < qr.size; x += 1) {
      const bit = qr.data[y][x] ? '1' : '0';
      for (let i = 0; i < scale; i += 1) line.push(bit);
    }
    const text = line.join(' ');
    for (let i = 0; i < scale; i += 1) rows.push(text);
  }
  return `P1\n${size} ${size}\n${rows.join('\n')}\n`;
}
