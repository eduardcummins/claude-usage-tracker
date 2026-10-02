import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function newKey() {
  return randomBytes(32).toString('base64url');
}

export function sealJson(key, value) {
  const rawKey = Buffer.from(key, 'base64url');
  if (rawKey.length !== 32) throw new Error('The encryption key must be 32 bytes.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', rawKey, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const ct = Buffer.concat([body, cipher.getAuthTag()]);
  return { v: 1, iv: iv.toString('base64url'), ct: ct.toString('base64url') };
}

export function openJson(key, sealed) {
  const rawKey = Buffer.from(key, 'base64url');
  const iv = Buffer.from(sealed.iv, 'base64url');
  const data = Buffer.from(sealed.ct, 'base64url');
  if (rawKey.length !== 32 || iv.length !== 12 || data.length < 17) {
    throw new Error('The encrypted report is not valid.');
  }
  const tag = data.subarray(data.length - 16);
  const ct = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', rawKey, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}
