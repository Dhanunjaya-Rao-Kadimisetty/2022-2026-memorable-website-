type LimitState = {
  attempts: number;
  resetAt: number;
  blockedUntil: number;
};

const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_BLOCK_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

function now() {
  return Date.now();
}

function getStore() {
  const globalForAdmin = globalThis as typeof globalThis & {
    __adminLoginStore?: Map<string, LimitState>;
  };

  if (!globalForAdmin.__adminLoginStore) {
    globalForAdmin.__adminLoginStore = new Map<string, LimitState>();
  }

  return globalForAdmin.__adminLoginStore;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const firstForwarded = forwardedFor.split(',')[0]?.trim();
  return firstForwarded || request.headers.get('x-real-ip') || 'unknown';
}

export function getLoginKey(request: Request, email: string) {
  return `${getClientIp(request)}:${email.toLowerCase()}`;
}

export function checkLoginLimit(key: string, options?: { windowMs?: number; maxAttempts?: number; blockMs?: number }) {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const blockMs = options?.blockMs ?? DEFAULT_BLOCK_MS;
  const store = getStore();
  const current = now();
  const state = store.get(key);

  if (!state) {
    return { allowed: true as const, retryAfterMs: 0 };
  }

  if (state.blockedUntil > current) {
    return { allowed: false as const, retryAfterMs: state.blockedUntil - current };
  }

  if (state.resetAt <= current) {
    store.delete(key);
    return { allowed: true as const, retryAfterMs: 0 };
  }

  if (state.attempts >= maxAttempts) {
    state.blockedUntil = current + blockMs;
    state.attempts = 0;
    state.resetAt = current + windowMs;
    store.set(key, state);
    return { allowed: false as const, retryAfterMs: blockMs };
  }

  return { allowed: true as const, retryAfterMs: 0 };
}

export function recordLoginFailure(
  key: string,
  options?: { windowMs?: number; maxAttempts?: number; blockMs?: number },
) {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const blockMs = options?.blockMs ?? DEFAULT_BLOCK_MS;
  const store = getStore();
  const current = now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= current) {
    store.set(key, {
      attempts: 1,
      resetAt: current + windowMs,
      blockedUntil: 0,
    });
    return;
  }

  const attempts = existing.attempts + 1;
  const blockedUntil = attempts >= maxAttempts ? current + blockMs : existing.blockedUntil;

  store.set(key, {
    attempts: attempts >= maxAttempts ? 0 : attempts,
    resetAt: attempts >= maxAttempts ? current + windowMs : existing.resetAt,
    blockedUntil,
  });
}

export function clearLoginLimit(key: string) {
  getStore().delete(key);
}

