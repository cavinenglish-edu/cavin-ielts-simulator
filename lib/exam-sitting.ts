import { LISTENING_SECONDS, READING_SECONDS, WRITING_SECONDS } from "@/lib/exam-skill";

export const REVIEW_SECONDS = 2 * 60;
export const SITTING_TTL_MS = 6 * 60 * 60 * 1000;
export const FIXTURE_PAPER_ID = "fixture-full";

export const EXAM_SECTIONS = ["pretest", "listening", "reading", "writing", "done"] as const;
export type ExamSection = (typeof EXAM_SECTIONS)[number];
export type ListeningPhase = "audio" | "review";

export const SECTION_PATH: Record<ExamSection, string> = {
  pretest: "/exam/check",
  listening: "/exam/listening",
  reading: "/exam/reading",
  writing: "/exam/writing",
  done: "/exam/receipt",
};

const GUARDED_PATHS = new Set(Object.values(SECTION_PATH));

export type ExamSession = {
  v: 1;
  exp: number;
  name: string;
  engName: string;
  phone: string;
  userType: "student" | "online" | "";
  candidateNumber: string;
  paperId: string;
  section: ExamSection;
  listeningPhase: ListeningPhase;
  sectionStartedAt: number;
  durationSeconds: number;
  accessGranted: boolean;
  clockOffsetMs: number;
};

export type PublicSession = {
  section: ExamSection;
  listeningPhase: ListeningPhase;
  paperId: string;
  startedAt: number;
  durationSeconds: number;
  clockOffsetMs: number;
  serverNow: number;
  name: string;
  engName: string;
  phone: string;
  userType: string;
  candidateNumber: string;
  accessGranted: boolean;
};

export function remainingSeconds(startedAt: number, durationSeconds: number, effectiveNow: number): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(durationSeconds) || !Number.isFinite(effectiveNow)) return 0;
  const elapsed = Math.floor((effectiveNow - startedAt) / 1000);
  return Math.max(0, durationSeconds - Math.max(0, elapsed));
}

export function effectiveNow(now: number, clockOffsetMs: number): number {
  const offset = Number.isFinite(clockOffsetMs) && clockOffsetMs > 0 ? clockOffsetMs : 0;
  return now + offset;
}

export function toPublic(session: ExamSession, serverNow: number): PublicSession {
  return {
    section: session.section,
    listeningPhase: session.listeningPhase,
    paperId: session.paperId,
    startedAt: session.sectionStartedAt,
    durationSeconds: session.durationSeconds,
    clockOffsetMs: session.clockOffsetMs > 0 ? session.clockOffsetMs : 0,
    serverNow,
    name: session.name,
    engName: session.engName,
    phone: session.phone,
    userType: session.userType,
    candidateNumber: session.candidateNumber,
    accessGranted: session.accessGranted,
  };
}

export function guardRedirect(session: ExamSession | null, pathname: string): string | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (!GUARDED_PATHS.has(path)) return null;
  if (!session) return "/exam";
  const expected = SECTION_PATH[session.section];
  if (path === expected) return null;
  return expected;
}

function touch(session: ExamSession, now: number): ExamSession {
  return { ...session, exp: now + SITTING_TTL_MS };
}

export function pretestSession(
  input: {
    name: string;
    engName?: string;
    phone?: string;
    userType?: "student" | "online" | "";
    candidateNumber: string;
  },
  now = Date.now(),
): ExamSession {
  return {
    v: 1,
    exp: now + SITTING_TTL_MS,
    name: input.name,
    engName: input.engName ?? "",
    phone: input.phone ?? "",
    userType: input.userType ?? "",
    candidateNumber: input.candidateNumber,
    paperId: "",
    section: "pretest",
    listeningPhase: "audio",
    sectionStartedAt: now,
    durationSeconds: 0,
    accessGranted: false,
    clockOffsetMs: 0,
  };
}

export function grantAccess(session: ExamSession, paperId: string, now: number): ExamSession {
  return touch(
    {
      ...session,
      paperId,
      accessGranted: true,
      section: "pretest",
    },
    now,
  );
}

export function beginListening(session: ExamSession, durationSeconds: number, now: number): ExamSession {
  return touch(
    {
      ...session,
      section: "listening",
      listeningPhase: "audio",
      sectionStartedAt: now,
      durationSeconds,
      clockOffsetMs: 0,
      accessGranted: true,
    },
    now,
  );
}

export function beginReview(
  session: ExamSession,
  now: number,
): { ok: true; session: ExamSession } | { ok: false; reason: "wrong-phase" } {
  if (session.section !== "listening" || session.listeningPhase !== "audio") {
    return { ok: false, reason: "wrong-phase" };
  }
  return {
    ok: true,
    session: touch(
      {
        ...session,
        listeningPhase: "review",
        sectionStartedAt: now,
        durationSeconds: REVIEW_SECONDS,
        clockOffsetMs: 0,
      },
      now,
    ),
  };
}

function enterSection(session: ExamSession, section: ExamSection, durationSeconds: number, now: number): ExamSession {
  return touch(
    {
      ...session,
      section,
      listeningPhase: "audio",
      sectionStartedAt: now,
      durationSeconds,
      clockOffsetMs: 0,
    },
    now,
  );
}

export function advanceSitting(
  session: ExamSession,
  now: number,
): { ok: true; session: ExamSession } | { ok: false; reason: "too-early" | "wrong-phase" | "finished" } {
  const left = remainingSeconds(session.sectionStartedAt, session.durationSeconds, effectiveNow(now, session.clockOffsetMs));
  if (session.section === "listening") {
    if (session.listeningPhase !== "review") return { ok: false, reason: "wrong-phase" };
    if (left > 0) return { ok: false, reason: "too-early" };
    return { ok: true, session: enterSection(session, "reading", READING_SECONDS, now) };
  }
  if (session.section === "reading") {
    if (left > 0) return { ok: false, reason: "too-early" };
    return { ok: true, session: enterSection(session, "writing", WRITING_SECONDS, now) };
  }
  if (session.section === "writing") {
    if (left > 0) return { ok: false, reason: "too-early" };
    return { ok: true, session: enterSection(session, "done", 0, now) };
  }
  return { ok: false, reason: "finished" };
}

export function shiftClock(session: ExamSession, addMs: number, now: number): ExamSession | null {
  if (!Number.isFinite(addMs) || addMs <= 0 || addMs > 4 * 60 * 60 * 1000) return null;
  return touch({ ...session, clockOffsetMs: session.clockOffsetMs + Math.floor(addMs) }, now);
}

export function isExamSection(value: unknown): value is ExamSection {
  return EXAM_SECTIONS.includes(value as ExamSection);
}

export function sessionFromUnknown(value: unknown, now = Date.now()): ExamSession | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ExamSession>;
  if (row.v !== 1) return null;
  if (typeof row.exp !== "number" || row.exp <= now) return null;
  if (!isExamSection(row.section)) return null;
  if (row.listeningPhase !== "audio" && row.listeningPhase !== "review") return null;
  if (typeof row.sectionStartedAt !== "number" || typeof row.durationSeconds !== "number") return null;
  if (typeof row.name !== "string" || typeof row.candidateNumber !== "string") return null;
  if (typeof row.paperId !== "string" || typeof row.accessGranted !== "boolean") return null;
  const clockOffsetMs = typeof row.clockOffsetMs === "number" && row.clockOffsetMs > 0 ? Math.floor(row.clockOffsetMs) : 0;
  const userType = row.userType === "student" || row.userType === "online" ? row.userType : "";
  return {
    v: 1,
    exp: row.exp,
    name: row.name,
    engName: typeof row.engName === "string" ? row.engName : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    userType,
    candidateNumber: row.candidateNumber,
    paperId: row.paperId,
    section: row.section,
    listeningPhase: row.listeningPhase,
    sectionStartedAt: row.sectionStartedAt,
    durationSeconds: row.durationSeconds,
    accessGranted: row.accessGranted,
    clockOffsetMs,
  };
}

export function listeningSecondsOrDefault(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 7200) return Math.floor(value);
  return LISTENING_SECONDS;
}
