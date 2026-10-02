import fs from 'node:fs/promises';
import path from 'node:path';
import { renderANSI, renderSVG } from '../vendor/uqr/index.mjs';
import { appPaths } from './paths.js';

export function renderTopicQr(code, legacyTopic = '') {
  const terminal = renderANSI(code, { ecc: 'M', border: 2 });
  const svg = renderSVG(code, {
    ecc: 'M',
    border: 2,
    pixelSize: 10,
    whiteColor: '#faf9f5',
    blackColor: '#141413',
  });
  const safe = escapeHtml(code);
  const legacy = legacyTopic
    ? `<p style="font-family:sans-serif;color:#6b6a64">Older topic, still works this release: ${escapeHtml(legacyTopic)}</p>`
    : '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cluse pairing</title>
</head>
<body style="margin:0;background:#faf9f5;color:#141413;font-family:Georgia,serif">
  <main style="max-width:28rem;margin:0 auto;padding:2.5rem 1.25rem;text-align:center">
    <h1 style="font-weight:500;font-size:2rem;margin:0">Cluse</h1>
    <p style="font-family:sans-serif;line-height:1.5">Scan this code in the app, or paste the line below.</p>
    <div style="margin:1.5rem auto;width:min(100%,280px)">${svg}</div>
    <p style="font-family:ui-monospace,monospace;font-size:0.85rem;word-break:break-all">${safe}</p>
    ${legacy}
    <p style="font-family:sans-serif;color:#6b6a64;font-size:0.95rem">This page stays on your computer. A pairing code is the encryption key. An older cu- topic is a password for the percentages.</p>
  </main>
</body>
</html>
`;
  return { terminal, svg, html };
}

export async function writeTopicPage(homeDir, code, legacyTopic = '') {
  const file = path.join(appPaths(homeDir).root, 'topic.html');
  const qr = renderTopicQr(code, legacyTopic);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, qr.html);
  return { ...qr, file };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
