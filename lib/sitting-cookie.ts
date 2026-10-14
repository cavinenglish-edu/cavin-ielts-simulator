import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  type ExamSection,
  type ExamSession,
  guardRedirect,
  SECTION_PATH,
  toPublic,
  type PublicSession,
} from "@/lib/exam-sitting";
import { EXAM_COOKIE, examCookieOptions, signSession, verifyExamSession } from "@/lib/exam-session-token";

function secret(): string {
  return process.env.EXAM_SESSION_SECRET ?? "";
}

export async function readSession(): Promise<ExamSession | null> {
  const jar = await cookies();
  const token = jar.get(EXAM_COOKIE)?.value ?? "";
  return verifyExamSession(token, secret());
}

export async function writeSession(session: ExamSession): Promise<void> {
  const jar = await cookies();
  jar.set(EXAM_COOKIE, signSession(session, secret()), examCookieOptions());
}

export function publicSession(session: ExamSession, serverNow = Date.now()): PublicSession {
  return toPublic(session, serverNow);
}

export async function requireSection(expected: ExamSection): Promise<ExamSession> {
  await connection();
  const session = await readSession();
  const target = guardRedirect(session, SECTION_PATH[expected]);
  if (target) redirect(target);
  if (!session) redirect("/exam");
  return session;
}
