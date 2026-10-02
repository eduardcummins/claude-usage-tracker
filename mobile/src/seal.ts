import { gcm } from '@noble/ciphers/aes';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils';

export function openJson(key: string, sealed: { iv: string; ct: string }): unknown {
  const rawKey = b64urlToBytes(key);
  const iv = b64urlToBytes(sealed.iv);
  const data = b64urlToBytes(sealed.ct);
  if (rawKey.length !== 32 || iv.length !== 12 || data.length < 17) {
    throw new Error('The encrypted report is not valid.');
  }
  const plain = gcm(rawKey, iv).decrypt(data);
  return JSON.parse(bytesToUtf8(plain));
}

export function sealJson(key: string, value: unknown): { v: 1; iv: string; ct: string } {
  const rawKey = b64urlToBytes(key);
  if (rawKey.length !== 32) throw new Error('The encryption key must be 32 bytes.');
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = gcm(rawKey, iv).encrypt(utf8ToBytes(JSON.stringify(value)));
  return { v: 1, iv: bytesToB64url(iv), ct: bytesToB64url(ct) };
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function b64urlToBytes(text: string): Uint8Array {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/') + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
