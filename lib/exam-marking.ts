import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

export const MISSING_AI_KEY = "chưa chấm được vì thiếu khóa AI";
export const MARKING_FAILED = "Chưa chấm được vì hệ thống chấm không trả lời đúng định dạng.";
export const NO_TRANSCRIPT = "Đã lưu bản ghi. Chưa chấm được vì chưa có lời thoại.";
export const NO_AUDIO = "Chưa chấm được vì không nghe được bản ghi.";

/**
 * gemini-3.8-flash accepts audio (webm, mp3, ogg, mp4) and images.
 * Speaking uses this same model so the examiner hears the recording.
 * https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
 */
export const SPEAKING_AUDIO_MODEL = "gemini-3.8-flash";

const KEY_NAMES = ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"] as const;
const CHART_BYTES = 7 * 1024 * 1024;
const CHART_MS = 5_000;
const CHART_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function markingModelName(env: Record<string, string | undefined> = process.env): string {
  return env.GEMINI_MODEL?.trim() || SPEAKING_AUDIO_MODEL;
}

export function readModelKey(env: Record<string, string | undefined>): string | null {
  for (const name of KEY_NAMES) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return null;
}

/** Nearest 0.5. For a positive score, .25 and .75 round up — the IELTS overall rule. */
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

/** Mean of the four skill bands. Missing a band means there is no overall. */
export function fourSkillOverall(bands: Array<number | null | undefined>): number | null {
  if (bands.length !== 4) return null;
  if (bands.some((band) => typeof band !== "number" || !Number.isFinite(band))) return null;
  const total = bands.reduce<number>((sum, band) => sum + (band as number), 0);
  return roundToHalf(total / 4);
}

export type WritingCriterionKey = "taskAchievement" | "coherenceCohesion" | "lexicalResource" | "grammaticalRangeAccuracy";
export type WritingTask2Key = "taskResponse" | "coherenceCohesion" | "lexicalResource" | "grammaticalRangeAccuracy";
export type ChartView = "none" | "seen" | "unseen";

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
  chart: ChartView;
};

export type SpeakingMark = {
  status: "marked";
  criteria: CriterionScore[];
  overall: number;
};

export type SpeakingAudioClip = {
  part: number;
  questionIndex: number;
  mimeType: string;
  base64: string;
};

export type SpeakingQuestionPrompt = {
  part: number;
  questionIndex: number;
  question: string;
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

const SPEAKING_RUBRIC = [
  "You are an IELTS speaking examiner. The candidate's answers are the audio clips attached to this request. You must listen to the audio.",
  "Score Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation.",
  "Each score is a multiple of 0.5 from 0 to 9.",
  "Pronunciation is scored only from the sound of the audio, not from a transcript. Do not invent a transcript and then score pronunciation from it.",
  "Write one short comment in Vietnamese for each criterion. Do not include a band inside the comment.",
  "Return JSON only:",
  '{"fluencyCoherence":6,"lexicalResource":6,"grammaticalRangeAccuracy":6,"pronunciation":6,"comments":{"fluencyCoherence":"...","lexicalResource":"...","grammaticalRangeAccuracy":"...","pronunciation":"..."}}',
].join("\n");

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
    chart: "none",
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

export function isPublicChartUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (host === "metadata.google.internal" || host === "0.0.0.0") return false;
  return !isPrivateAddress(host);
}

function isPrivateAddress(host: string): boolean {
  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const parts = match.slice(1).map((part) => Number(part));
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function chartMime(header: string | null): string | null {
  const mime = header?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime === "image/jpg") return "image/jpeg";
  return CHART_TYPES.has(mime) ? mime : null;
}

export async function fetchChartImage(url: string): Promise<{ mimeType: string; data: string } | null> {
  let current = url.trim();
  for (let hop = 0; hop < 3; hop += 1) {
    if (!isPublicChartUrl(current)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHART_MS);
    try {
      const response = await fetch(current, { redirect: "manual", signal: controller.signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }
      if (!response.ok) return null;
      const mimeType = chartMime(response.headers.get("content-type"));
      if (!mimeType) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0 || buffer.byteLength > CHART_BYTES) return null;
      return { mimeType, data: buffer.toString("base64") };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export function writingRequestParts(
  input: {
    task1Prompt: string;
    task1ImageUrl?: string;
    task1Essay: string;
    task2Prompt: string;
    task2Essay: string;
  },
  chart: { mimeType: string; data: string } | null,
): { parts: Part[]; chart: ChartView } {
  const asked = Boolean(input.task1ImageUrl?.trim());
  const seen = Boolean(asked && chart?.data);
  const chartView: ChartView = !asked ? "none" : seen ? "seen" : "unseen";
  const chartLine =
    chartView === "seen"
      ? "The Task 1 chart is the attached image. Score Task Achievement from that diagram."
      : chartView === "unseen"
        ? "The Task 1 chart could not be loaded. You cannot see the diagram. Score Task Achievement from the written prompt only. Do not invent details from a chart."
        : "Task 1 has no chart.";
  const text = [
    "You are an IELTS Academic writing examiner.",
    "Score Task 1 on Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.",
    "Score Task 2 on Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.",
    "Each score is a multiple of 0.5 from 0 to 9.",
    "Write one short comment in Vietnamese for each criterion. Do not include a band inside the comment.",
    "Return JSON only with this shape:",
    '{"task1":{"taskAchievement":6.5,"coherenceCohesion":6,"lexicalResource":6,"grammaticalRangeAccuracy":6,"comments":{"taskAchievement":"...","coherenceCohesion":"...","lexicalResource":"...","grammaticalRangeAccuracy":"..."}},"task2":{"taskResponse":6.5,"coherenceCohesion":6,"lexicalResource":6,"grammaticalRangeAccuracy":6,"comments":{"taskResponse":"...","coherenceCohesion":"...","lexicalResource":"...","grammaticalRangeAccuracy":"..."}}}',
    chartLine,
    `Task 1 prompt: ${clip(input.task1Prompt, 4000)}`,
    `Task 1 essay: ${clip(input.task1Essay, 12000)}`,
    `Task 2 prompt: ${clip(input.task2Prompt, 4000)}`,
    `Task 2 essay: ${clip(input.task2Essay, 12000)}`,
  ].join("\n");
  const parts: Part[] = [];
  if (seen && chart) parts.push({ inlineData: { mimeType: chart.mimeType, data: chart.data } });
  parts.push({ text });
  return { parts, chart: chartView };
}

export function speakingPromptParts(input: {
  clips: SpeakingAudioClip[];
  questions: SpeakingQuestionPrompt[];
}): Part[] | null {
  const audible = input.clips.filter((clip) => clip.base64.trim() && clip.mimeType.startsWith("audio/"));
  if (audible.length === 0) return null;
  const parts: Part[] = [{ text: SPEAKING_RUBRIC }];
  for (const clip of audible) {
    const question = input.questions.find((item) => item.part === clip.part && item.questionIndex === clip.questionIndex);
    parts.push({
      text: `Part ${clip.part}, answer ${clip.questionIndex + 1}. Question: ${question?.question.trim() || "Question text was not stored."}`,
    });
    parts.push({ inlineData: { mimeType: clip.mimeType, data: clip.base64 } });
  }
  return parts;
}

async function complete(parts: Part[], key: string): Promise<string | null> {
  try {
    const ai = new GoogleGenerativeAI(key);
    const model = ai.getGenerativeModel({
      model: markingModelName(),
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    });
    const result = await model.generateContent(parts);
    const text = result.response.text();
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

type MarkerIO = {
  loadChart?: (url: string) => Promise<{ mimeType: string; data: string } | null>;
  complete?: (parts: Part[], key: string) => Promise<string | null>;
};

export async function markWritingEssays(
  input: {
    task1Prompt: string;
    task1ImageUrl?: string;
    task1Essay: string;
    task2Prompt: string;
    task2Essay: string;
  },
  key: string,
  io?: MarkerIO,
): Promise<WritingMark | null> {
  if (!key.trim()) return null;
  let chart: { mimeType: string; data: string } | null = null;
  if (input.task1ImageUrl?.trim()) {
    try {
      chart = await (io?.loadChart ?? fetchChartImage)(input.task1ImageUrl.trim());
    } catch {
      chart = null;
    }
  }
  const request = writingRequestParts(input, chart);
  const raw = await (io?.complete ?? complete)(request.parts, key);
  if (!raw) return null;
  const marked = parseWritingMark(raw);
  if (!marked) return null;
  return { ...marked, chart: request.chart };
}

export async function markSpeakingAudio(
  input: { clips: SpeakingAudioClip[]; questions: SpeakingQuestionPrompt[] },
  key: string,
  completeFn: (parts: Part[], key: string) => Promise<string | null> = complete,
): Promise<SpeakingMark | null> {
  if (!key.trim()) return null;
  const parts = speakingPromptParts(input);
  if (!parts) return null;
  const raw = await completeFn(parts, key);
  if (!raw) return null;
  return parseSpeakingMark(raw);
}
