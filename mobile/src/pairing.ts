export type RelayLink = {
  kind: 'relay';
  url: string;
  deviceId: string;
  key: string;
};

export function decodePairing(value: string): RelayLink | null {
  const text = value.trim();
  if (!text.startsWith('cluse1.')) return null;
  let parsed: { v?: number; url?: string; id?: string; key?: string };
  try {
    parsed = JSON.parse(bytesToString(b64urlToBytes(text.slice('cluse1.'.length)))) as {
      v?: number;
      url?: string;
      id?: string;
      key?: string;
    };
  } catch {
    return null;
  }
  if (!parsed || parsed.v !== 1) return null;
  const url = String(parsed.url || '').replace(/\/$/, '');
  const deviceId = String(parsed.id || '');
  const key = String(parsed.key || '');
  if (!allowedUrl(url)) return null;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(deviceId)) return null;
  if (b64urlToBytes(key).length !== 32) return null;
  return { kind: 'relay', url, deviceId, key };
}

function allowedUrl(url: string): boolean {
  if (/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(url)) return true;
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(url);
}

function b64urlToBytes(text: string): Uint8Array {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/') + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToString(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}
