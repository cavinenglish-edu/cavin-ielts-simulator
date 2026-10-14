import { createHash, createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "cavin_admin_session";
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type SessionPayload = {
  exp: number;
  nonce: string;
};

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSessionToken(secret: string, now = Date.now()): string {
  if (!secret) {
    throw new Error("ADMIN_PASSWORD is empty");
  }
  const payload: SessionPayload = {
    exp: now + ADMIN_SESSION_TTL_MS,
    nonce: createHash("sha256").update(`${now}:${secret.length}`).digest("base64url").slice(0, 16),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyAdminSessionToken(token: string, secret: string, now = Date.now()): boolean {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, signature] = parts;
  if (!body || !signature) return false;
  const expected = sign(body, secret);
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    return typeof parsed.exp === "number" && parsed.exp > now;
  } catch {
    return false;
  }
}

export function passwordsMatch(input: string, expected: string): boolean {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

const DEFAULT_LIMIT = 8;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

function recentAttempts(store: Map<string, number[]>, key: string, now: number, windowMs: number): number[] {
  const kept = (store.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  store.set(key, kept);
  return kept;
}

export function isRateLimited(
  store: Map<string, number[]>,
  key: string,
  now: number,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
): boolean {
  return recentAttempts(store, key, now, windowMs).length >= limit;
}

export function recordFailure(
  store: Map<string, number[]>,
  key: string,
  now: number,
  windowMs = DEFAULT_WINDOW_MS,
): void {
  const kept = recentAttempts(store, key, now, windowMs);
  kept.push(now);
  store.set(key, kept);
}
