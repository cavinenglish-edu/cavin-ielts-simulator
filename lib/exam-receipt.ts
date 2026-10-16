import { PRACTICE_MIX_ID } from "@/lib/exam-catalog";
import { fourSkillOverall, MARKING_FAILED, MISSING_AI_KEY, NO_AUDIO, NO_TRANSCRIPT } from "@/lib/exam-marking";
import { objectiveBand } from "@/lib/ielts-band";

export type ReceiptKind = "actual" | "mix" | "forecast";

export type ReceiptSource = {
  skill: string;
  marking_status: string;
  section_started_at?: number;
  score: unknown;
};

export type ReceiptItem = {
  id: string;
  prompt: string;
  given: string;
  expected: string;
  ok: boolean;
};

export type ReceiptCriterion = {
  key: string;
  label: string;
  score: number;
  comment: string;
};

export type ReceiptLine = {
  skill: string;
  sent: true;
  headline: string;
  note: string;
  correct?: number;
  total?: number;
  band?: number;
  estimated?: boolean;
  scaledRaw?: number;
  chart?: "none" | "seen" | "unseen";
  items?: ReceiptItem[];
  criteria?: ReceiptCriterion[];
};

const ORDER: Record<ReceiptKind, string[]> = {
  actual: ["listening", "reading", "writing", "speaking"],
  mix: ["listening", "reading", "writing"],
  forecast: ["speaking"],
};

export function receiptKind(paperId: string, catalog: "actual" | "forecast" | null): ReceiptKind {
  if (paperId === PRACTICE_MIX_ID) return "mix";
  if (catalog === "forecast") return "forecast";
  return "actual";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function statusNote(status: string): string {
  if (status === "pending_key") return MISSING_AI_KEY;
  if (status === "no_transcript" || status === "no_audio") return status === "no_audio" ? NO_AUDIO : NO_TRANSCRIPT;
  if (status === "marking_failed") return MARKING_FAILED;
  return "";
}

function readItems(score: Record<string, unknown> | null): ReceiptItem[] {
  if (!score || !Array.isArray(score.items)) return [];
  return score.items.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string" || typeof row.prompt !== "string") return [];
    return [
      {
        id: row.id,
        prompt: row.prompt,
        given: typeof row.given === "string" ? row.given : "",
        expected: typeof row.expected === "string" ? row.expected : "",
        ok: row.ok === true,
      },
    ];
  });
}

function readCriteria(value: unknown, prefix: string): ReceiptCriterion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.key !== "string" || typeof row.label !== "string") return [];
    if (typeof row.score !== "number" || typeof row.comment !== "string") return [];
    return [{ key: `${prefix}${row.key}`, label: prefix ? `${prefix}${row.label}` : row.label, score: row.score, comment: row.comment }];
  });
}

function latestBySkill(rows: ReceiptSource[]): Map<string, ReceiptSource> {
  const map = new Map<string, ReceiptSource>();
  for (const row of rows) {
    const current = map.get(row.skill);
    const nextAt = row.section_started_at ?? 0;
    const currentAt = current?.section_started_at ?? 0;
    if (!current || nextAt >= currentAt) map.set(row.skill, row);
  }
  return map;
}

function objectiveLine(skill: "listening" | "reading", row: ReceiptSource, revealKey: boolean): ReceiptLine {
  const score = asRecord(row.score);
  const correct = typeof score?.correct === "number" ? score.correct : undefined;
  const total = typeof score?.total === "number" ? score.total : undefined;
  const storedBand = typeof score?.band === "number" ? score.band : undefined;
  const storedEstimated = typeof score?.estimated === "boolean" ? score.estimated : undefined;
  const converted = typeof correct === "number" && typeof total === "number" ? objectiveBand(skill, correct, total) : null;
  const band = storedBand ?? converted?.band;
  const estimated = storedEstimated ?? converted?.estimated;
  const scaledRaw = typeof score?.scaledRaw === "number" ? score.scaledRaw : converted?.raw;
  return {
    skill,
    sent: true,
    headline: "Bài đã được gửi.",
    note: statusNote(row.marking_status),
    correct,
    total,
    ...(typeof band === "number" ? { band } : {}),
    ...(typeof estimated === "boolean" ? { estimated } : {}),
    ...(typeof scaledRaw === "number" ? { scaledRaw } : {}),
    ...(revealKey ? { items: readItems(score) } : {}),
  };
}

function markedBand(row: ReceiptSource): { band?: number; chart?: "none" | "seen" | "unseen"; criteria?: ReceiptCriterion[] } {
  if (row.marking_status !== "marked") return {};
  const score = asRecord(row.score);
  const band = typeof score?.overall === "number" ? score.overall : undefined;
  const chart = score?.chart === "seen" || score?.chart === "unseen" || score?.chart === "none" ? score.chart : undefined;
  if (row.skill === "writing") {
    const criteria = [...readCriteria(score?.task1, "Task 1 · "), ...readCriteria(score?.task2, "Task 2 · ")];
    return { band, chart, ...(criteria.length > 0 ? { criteria } : {}) };
  }
  const criteria = readCriteria(score?.criteria, "");
  return { band, ...(criteria.length > 0 ? { criteria } : {}) };
}

function lineFor(skill: string, row: ReceiptSource, revealKey: boolean): ReceiptLine {
  if (skill === "listening" || skill === "reading") return objectiveLine(skill, row, revealKey);
  const marked = markedBand(row);
  const unseen = marked.chart === "unseen" ? "Biểu đồ Task 1 không được nhìn thấy khi chấm." : "";
  return {
    skill,
    sent: true,
    headline: "Bài đã được gửi.",
    note: [statusNote(row.marking_status), unseen].filter(Boolean).join(" "),
    ...marked,
  };
}

export function buildReceipt(
  kind: ReceiptKind,
  rows: ReceiptSource[],
  revealKey: boolean,
): { kind: ReceiptKind; overall: number | null; submissions: ReceiptLine[] } {
  const bySkill = latestBySkill(rows);
  const submissions = ORDER[kind].flatMap((skill) => {
    const row = bySkill.get(skill);
    return row ? [lineFor(skill, row, revealKey)] : [];
  });
  const overall =
    kind === "actual"
      ? fourSkillOverall(ORDER.actual.map((skill) => submissions.find((line) => line.skill === skill)?.band))
      : null;
  return { kind, overall, submissions };
}
