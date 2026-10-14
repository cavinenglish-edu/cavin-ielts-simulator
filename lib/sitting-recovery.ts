export type PassageMark = {
  id: string;
  passageId: string;
  start: number;
  end: number;
  note: string;
};

export type RecoveryState = {
  paperId: string;
  listening: Record<string, string>;
  reading: Record<string, string>;
  marks: PassageMark[];
  task1: string;
  task2: string;
  writingTask: 1 | 2;
};

export const RECOVERY_KEY = "ielts_sitting_recovery";

export function emptyRecovery(paperId: string): RecoveryState {
  return {
    paperId,
    listening: {},
    reading: {},
    marks: [],
    task1: "",
    task2: "",
    writingTask: 1,
  };
}

export function parseRecovery(raw: string | null, paperId: string): RecoveryState {
  if (!raw) return emptyRecovery(paperId);
  try {
    const parsed = JSON.parse(raw) as Partial<RecoveryState>;
    if (!parsed || parsed.paperId !== paperId) return emptyRecovery(paperId);
    return {
      paperId,
      listening: isStringMap(parsed.listening) ? parsed.listening : {},
      reading: isStringMap(parsed.reading) ? parsed.reading : {},
      marks: Array.isArray(parsed.marks) ? parsed.marks.filter(isMark) : [],
      task1: typeof parsed.task1 === "string" ? parsed.task1 : "",
      task2: typeof parsed.task2 === "string" ? parsed.task2 : "",
      writingTask: parsed.writingTask === 2 ? 2 : 1,
    };
  } catch {
    return emptyRecovery(paperId);
  }
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((item) => typeof item === "string");
}

function isMark(value: unknown): value is PassageMark {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PassageMark>;
  return (
    typeof row.id === "string" &&
    typeof row.passageId === "string" &&
    typeof row.start === "number" &&
    typeof row.end === "number" &&
    typeof row.note === "string" &&
    row.end > row.start
  );
}
