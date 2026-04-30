import crypto from 'node:crypto';

export type PendingAdminSession = {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type ChallengeState = {
  session: PendingAdminSession;
  createdAt: number;
  attempts: number;
};

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const DIGITS = 6;

function getChallengeStore() {
  const globalForAdmin = globalThis as typeof globalThis & {
    __adminLoginChallenges?: Map<string, ChallengeState>;
  };

  if (!globalForAdmin.__adminLoginChallenges) {
    globalForAdmin.__adminLoginChallenges = new Map<string, ChallengeState>();
  }

  return globalForAdmin.__adminLoginChallenges;
}

function base32ToBytes(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';

  for (const char of cleaned) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  }

  return bytes;
}

function hotp(secret: string, counter: number) {
  const key = base32ToBytes(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', Buffer.from(key));
  hmac.update(counterBuffer);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

export function normalizeTotpSecret(secret: string) {
  return secret.replace(/\s+/g, '').toUpperCase();
}

export function verifyTotpCode(secret: string, code: string, window = 1) {
  const normalizedSecret = normalizeTotpSecret(secret);
  const normalizedCode = code.replace(/\s+/g, '').trim();

  if (!normalizedSecret || !/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const currentStep = Math.floor(Date.now() / 30_000);
  for (let offset = -window; offset <= window; offset += 1) {
    if (hotp(normalizedSecret, currentStep + offset) === normalizedCode) {
      return true;
    }
  }

  return false;
}

export function createLoginChallenge(session: PendingAdminSession) {
  const id = crypto.randomUUID();
  getChallengeStore().set(id, {
    session,
    createdAt: Date.now(),
    attempts: 0,
  });
  return id;
}

export function consumeLoginChallenge(id: string) {
  const store = getChallengeStore();
  const challenge = store.get(id);

  if (!challenge) {
    return null;
  }

  if (Date.now() - challenge.createdAt > CHALLENGE_TTL_MS) {
    store.delete(id);
    return null;
  }

  store.delete(id);
  return challenge.session;
}

export function peekLoginChallenge(id: string) {
  const store = getChallengeStore();
  const challenge = store.get(id);

  if (!challenge) {
    return null;
  }

  if (Date.now() - challenge.createdAt > CHALLENGE_TTL_MS) {
    store.delete(id);
    return null;
  }

  return challenge.session;
}

export function recordLoginChallengeAttempt(id: string, maxAttempts = 5) {
  const store = getChallengeStore();
  const challenge = store.get(id);

  if (!challenge) {
    return { allowed: false as const, remaining: 0 };
  }

  if (Date.now() - challenge.createdAt > CHALLENGE_TTL_MS) {
    store.delete(id);
    return { allowed: false as const, remaining: 0 };
  }

  challenge.attempts += 1;
  if (challenge.attempts >= maxAttempts) {
    store.delete(id);
    return { allowed: false as const, remaining: 0 };
  }

  store.set(id, challenge);
  return { allowed: true as const, remaining: maxAttempts - challenge.attempts };
}
