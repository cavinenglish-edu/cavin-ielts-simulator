import { createHmac, timingSafeEqual } from "crypto";
import { sessionFromUnknown, type ExamSession } from "@/lib/exam-sitting";

export const EXAM_COOKIE = "cavin_exam_sitting";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(session: ExamSession, secret: string): string {
  if (!secret) throw new Error("EXAM_SESSION_SECRET is empty");
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyExamSession(token: string, secret: string, now = Date.now()): ExamSession | null {
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;
  const expected = sign(body, secret);
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return sessionFromUnknown(parsed, now);
  } catch {
    return null;
  }
}

export function codesMatch(input: string, expected: string): boolean {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function examCookieOptions(maxAge = 6 * 60 * 60) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
