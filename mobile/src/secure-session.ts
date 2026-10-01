import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { base64Url, buildAuthorizeUrl } from './claude';
import type { LoginAttempt, Session } from './claude';

const SESSION = 'planpace.session';
const ATTEMPT = 'planpace.attempt';
const CHUNK = 1500;
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export async function createLoginAttempt(now = Date.now()): Promise<LoginAttempt & { url: string }> {
  const verifier = base64Url(Crypto.getRandomBytes(32));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = digest.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
  const state = base64Url(Crypto.getRandomBytes(16));
  const attempt = { verifier, state, createdAt: now };
  await saveJson(ATTEMPT, attempt);
  return { ...attempt, url: buildAuthorizeUrl({ challenge, state }) };
}

export async function loadLoginAttempt(): Promise<LoginAttempt | null> {
  try {
    return await readJson<LoginAttempt>(ATTEMPT);
  } catch {
    return null;
  }
}

export async function clearLoginAttempt(): Promise<void> {
  await deleteSecret(ATTEMPT);
}

export async function loadSession(): Promise<Session | null> {
  try {
    const session = await readJson<Session>(SESSION);
    if (!session?.accessToken || !session.refreshToken) return null;
    return session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await saveJson(SESSION, session);
}

export async function clearSession(): Promise<void> {
  await deleteSecret(SESSION);
  await deleteSecret(ATTEMPT);
}

async function saveJson(key: string, value: unknown): Promise<void> {
  await writeSecret(key, JSON.stringify(value));
}

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await readSecret(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeSecret(key: string, value: string): Promise<void> {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
  const previous = Number((await SecureStore.getItemAsync(`${key}.count`, options)) || 0);
  await SecureStore.setItemAsync(`${key}.count`, String(parts.length), options);
  for (let i = 0; i < parts.length; i += 1) {
    await SecureStore.setItemAsync(`${key}.${i}`, parts[i], options);
  }
  for (let i = parts.length; i < previous; i += 1) {
    await SecureStore.deleteItemAsync(`${key}.${i}`, options).catch(() => undefined);
  }
}

async function readSecret(key: string): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(`${key}.count`, options));
  if (!Number.isFinite(count) || count < 1) return null;
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`, options);
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function deleteSecret(key: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(`${key}.count`, options)) || 0);
  await SecureStore.deleteItemAsync(`${key}.count`, options).catch(() => undefined);
  const total = Number.isFinite(count) ? count : 0;
  for (let i = 0; i < total; i += 1) {
    await SecureStore.deleteItemAsync(`${key}.${i}`, options).catch(() => undefined);
  }
}
