import { GoogleGenerativeAI } from "@google/generative-ai";

export const MISSING_AI_KEY = "chưa chấm được vì thiếu khóa AI";
export const MARKING_FAILED = "Chưa chấm được vì hệ thống chấm không trả lời đúng định dạng.";
export const NO_TRANSCRIPT = "Đã lưu bản ghi. Chưa chấm được vì chưa có lời thoại.";

const KEY_NAMES = ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"] as const;

export function readModelKey(env: Record<string, string | undefined>): string | null {
  for (const name of KEY_NAMES) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return null;
}

export function roundToHalf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(9, Math.max(0, value));
  return Math.round(clamped * 2) / 2;
}

export function averageBand(scores: number[]): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return roundToHalf(total / scores.length);
}

/** Task 2 counts double Task 1, then the result rounds to the nearest 0.5. */
export function writingOverallBand(task1: number, task2: number): number {
  return roundToHalf((task1 + task2 * 2) / 3);
}

export type WritingCriterionKey = "taskAchievement" | "coherenceCohesion" | "lexicalResource" | "grammaticalRangeAccuracy";
export type WritingTask2Key = "taskResponse" | "coherenceCohesion" | "lexicalResource" | "grammaticalRangeAccuracy";

export type CriterionScore = {
  key: string;
  label: string;
  score: number;
  comment: string;
};

export type WritingMark = {
  status: "marked";
  task1: CriterionScore[];
  task2: CriterionScore[];
  task1Band: number;
  task2Band: number;
  overall: number;
};

export type SpeakingMark = {
  status: "marked";
  criteria: CriterionScore[];
  overall: number;
};

const TASK1_FIELDS: Array<{ key: WritingCriterionKey; label: string }> = [
  { key: "taskAchievement", label: "Task Achievement" },
  { key: "coherenceCohesion", label: "Coherence and Cohesion" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammaticalRangeAccuracy", label: "Grammatical Range and Accuracy" },
];

const TASK2_FIELDS: Array<{ key: WritingTask2Key; label: string }> = [
  { key: "taskResponse", label: "Task Response" },
  { key: "coherenceCohesion", label: "Coherence and Cohesion" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammaticalRangeAccuracy", label: "Grammatical Range and Accuracy" },
];

const SPEAKING_FIELDS = [
  { key: "fluencyCoherence", label: "Fluency and Coherence" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammaticalRangeAccuracy", label: "Grammatical Range and Accuracy" },
  { key: "pronunciation", label: "Pronunciation" },
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function bandValue(value: unknown): number | null {
  const score = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(score) || score < 0 || score > 9) return null;
  const rounded = Math.round(score * 2) / 2;
  if (Math.abs(rounded - score) > 0.001) return null;
  return rounded;
}

function commentValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 600) return null;
  return trimmed;
}

function readCriterion(
  row: Record<string, unknown> | null,
  comments: Record<string, unknown> | null,
  key: string,
  label: string,
): CriterionScore | null {
  const score = bandValue(row?.[key]);
  const comment = commentValue(comments?.[key]);
  if (score === null || !comment) return null;
  return { key, label, score, comment };
}

export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function parseWritingMark(raw: string): WritingMark | null {
  const parsed = asRecord(parseModelJson(raw));
  const task1 = asRecord(parsed?.task1);
  const task2 = asRecord(parsed?.task2);
  const task1Comments = asRecord(task1?.comments);
  const task2Comments = asRecord(task2?.comments);
  const task1Scores = TASK1_FIELDS.map((field) => readCriterion(task1, task1Comments, field.key, field.label));
  const task2Scores = TASK2_FIELDS.map((field) => readCriterion(task2, task2Comments, field.key, field.label));
  if (task1Scores.some((item) => !item) || task2Scores.some((item) => !item)) return null;
  const task1Band = averageBand(task1Scores.map((item) => item!.score));
  const task2Band = averageBand(task2Scores.map((item) => item!.score));
  return {
    status: "marked",
    task1: task1Scores as CriterionScore[],
    task2: task2Scores as CriterionScore[],
    task1Band,
    task2Band,
    overall: writingOverallBand(task1Band, task2Band),
  };
}

export function parseSpeakingMark(raw: string): SpeakingMark | null {
  const parsed = asRecord(parseModelJson(raw));
  const comments = asRecord(parsed?.comments);
  const criteria = SPEAKING_FIELDS.map((field) => readCriterion(parsed, comments, field.key, field.label));
  if (criteria.some((item) => !item)) return null;
  const scores = criteria as CriterionScore[];
  return {
    status: "marked",
    criteria: scores,
    overall: averageBand(scores.map((item) => item.score)),
  };
}

async function complete(prompt: string, key: string): Promise<string | null> {
  try {
    // gemini-2.5-flash is closed to new keys. GEMINI_MODEL can override this.
    const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
    const ai = new GoogleGenerativeAI(key);
    const model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export async function markWritingEssays(
  input: {
    task1Prompt: string;
    task1ImageUrl?: string;
    task1Essay: string;
    task2Prompt: string;
    task2Essay: string;
  },
  key: string,
): Promise<WritingMark | null> {
  const prompt = [
    "You are an IELTS Academic writing examiner.",
    "Score Task 1 on Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.",
    "Score Task 2 on Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.",
    "Each score is a multiple of 0.5 from 0 to 9.",
    "Write one short comment in Vietnamese for each criterion. Do not include a band inside the comment.",
    "Return JSON only with this shape:",
    '{"task1":{"taskAchievement":6.5,"coherenceCohesion":6,"lexicalResource":6,"grammaticalRangeAccuracy":6,"comments":{"taskAchievement":"...","coherenceCohesion":"...","lexicalResource":"...","grammaticalRangeAccuracy":"..."}},"task2":{"taskResponse":6.5,"coherenceCohesion":6,"lexicalResource":6,"grammaticalRangeAccuracy":6,"comments":{"taskResponse":"...","coherenceCohesion":"...","lexicalResource":"...","grammaticalRangeAccuracy":"..."}}}',
    `Task 1 prompt: ${clip(input.task1Prompt, 4000)}`,
    input.task1ImageUrl ? `Task 1 image URL: ${clip(input.task1ImageUrl, 500)}` : "Task 1 image: none",
    `Task 1 essay: ${clip(input.task1Essay, 12000)}`,
    `Task 2 prompt: ${clip(input.task2Prompt, 4000)}`,
    `Task 2 essay: ${clip(input.task2Essay, 12000)}`,
  ].join("\n");
  const raw = await complete(prompt, key);
  if (!raw) return null;
  return parseWritingMark(raw);
}

export async function markSpeakingTranscript(transcript: string, key: string): Promise<SpeakingMark | null> {
  const prompt = [
    "You are an IELTS speaking examiner.",
    "Score Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation.",
    "Each score is a multiple of 0.5 from 0 to 9.",
    "Pronunciation can only be judged from the words on the page, so be conservative.",
    "Write one short comment in Vietnamese for each criterion.",
    "Return JSON only:",
    '{"fluencyCoherence":6,"lexicalResource":6,"grammaticalRangeAccuracy":6,"pronunciation":6,"comments":{"fluencyCoherence":"...","lexicalResource":"...","grammaticalRangeAccuracy":"...","pronunciation":"..."}}',
    `Transcript: ${clip(transcript, 12000)}`,
  ].join("\n");
  const raw = await complete(prompt, key);
  if (!raw) return null;
  return parseSpeakingMark(raw);
}
