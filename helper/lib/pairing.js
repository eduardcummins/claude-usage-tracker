export function encodePairing({ url, topic, key }) {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, url: url.replace(/\/$/, ''), topic, key }),
    'utf8',
  ).toString('base64url');
  return `cluse1.${payload}`;
}

export function decodePairing(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('cluse1.')) return null;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(text.slice('cluse1.'.length), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || parsed.v !== 1) return null;
  const url = String(parsed.url || '').replace(/\/$/, '');
  const topic = String(parsed.topic || '');
  const key = String(parsed.key || '');
  if (!allowedUrl(url)) return null;
  if (!/^[-_A-Za-z0-9]{1,59}$/.test(topic)) return null;
  if (Buffer.from(key, 'base64url').length !== 32) return null;
  return { url, topic, key };
}

function allowedUrl(url) {
  if (/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(url)) return true;
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(url);
}
