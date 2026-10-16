import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { countWords } from "./ielts-score";

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
  "You are a strict IELTS speaking examiner. Give one set of scores for the whole test. The candidate's answers are the audio clips attached to this request. You must listen to the audio.",
  "Score Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation.",
  "Each score is a multiple of 0.5 from 0 to 9. Award 7 only when the performance shows the features of a 7. A generous reading of a 6 is not a 7. Do not cluster every candidate at 6.5 or 7.",
  "Pronunciation is scored only from the sound: intelligibility, stress, rhythm, and intonation, not from a transcript. Do not score pronunciation from a transcript. Do not write a transcript. Accent by itself is not a penalty.",
  "Hesitation that breaks the message, a short Part 2 answer, and an answer that misses the question hold the score down. A 7 needs extended answers and flexible language, not only correct simple sentences.",
  "Write one comment in Vietnamese for each criterion. Name one concrete strength you heard and one concrete limit. No empty praise. Do not include a band inside the comment.",
  "Return JSON only:",
  '{"fluencyCoherence":5.5,"lexicalResource":6,"grammaticalRangeAccuracy":5.5,"pronunciation":6,"comments":{"fluencyCoherence":"...","lexicalResource":"...","grammaticalRangeAccuracy":"...","pronunciation":"..."}}',
].join("\n");

const WRITING_RUBRIC = [
  "You are a strict IELTS Academic writing examiner. Score only from the candidate script and the question.",
  "Score Task 1 on Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.",
  "Task 1 needs a clear overview and accurate comparisons. Penalise invented data and personal opinion.",
  "Score Task 2 on Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.",
  "Task 2 needs a position, ideas that are developed, and a conclusion that answers the question. A memorised opening does not raise the score.",
  "If Task 1 is under 150 words, lower Task Achievement and state the word count in that comment. If Task 2 is under 250 words, lower Task Response and state the word count in that comment.",
  "Each score is a multiple of 0.5 from 0 to 9. Award 7 only when the script shows the features of a 7 on that criterion. A generous reading of a 6 is not a 7. Do not cluster every script at 6.5 or 7. Use the rest of the scale when the script is weaker or stronger.",
  "Each comment is in Vietnamese. Name one concrete thing in the script that earned the score and one concrete limit. No empty praise. For a score of 7 or higher, quote a short span that appears in the script. Do not include a band inside the comment.",
  "Do not return an overall band. Task 2 is weighted double Task 1 by the system.",
  "Return JSON only with this shape:",
  '{"task1":{"taskAchievement":5.5,"coherenceCohesion":5,"lexicalResource":6,"grammaticalRangeAccuracy":5,"comments":{"taskAchievement":"...","coherenceCohesion":"...","lexicalResource":"...","grammaticalRangeAccuracy":"..."}},"task2":{"taskResponse":6,"coherenceCohesion":5.5,"lexicalResource":6,"grammaticalRangeAccuracy":5.5,"comments":{"taskResponse":"...","coherenceCohesion":"...","lexicalResource":"...","grammaticalRangeAccuracy":"..."}}}',
].join("\n");

const BAND_LIMIT = /nhưng|tuy nhiên|hạn chế|chưa|thiếu|giới hạn|however|although/i;
const DIAGRAM_NOTE = "Biểu đồ không có để đối chiếu.";

export type WritingScripts = {
  task1Essay: string;
  task2Essay: string;
};

function scriptWords(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];
}

/** A 7 or above must quote the script and name a limit. Empty praise is not a justification. */
function commentJustifiesBand(score: number, comment: string, script: string | undefined): boolean {
  if (score < 7) return true;
  if (!script?.trim() || !BAND_LIMIT.test(comment)) return false;
  const source = scriptWords(script);
  if (source.length < 2) return false;
  const hay = ` ${scriptWords(comment).join(" ")} `;
  const widest = Math.min(source.length, 8);
  for (let size = widest; size >= 2; size -= 1) {
    for (let index = 0; index + size <= source.length; index += 1) {
      const phrase = source.slice(index, index + size).join(" ");
      if (phrase.length < 8) continue;
      if (hay.includes(` ${phrase} `)) return true;
    }
  }
  return false;
}

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

export function parseWritingMark(raw: string, scripts?: WritingScripts): WritingMark | null {
  const parsed = asRecord(parseModelJson(raw));
  const task1 = asRecord(parsed?.task1);
  const task2 = asRecord(parsed?.task2);
  const task1Comments = asRecord(task1?.comments);
  const task2Comments = asRecord(task2?.comments);
  const task1Scores = TASK1_FIELDS.map((field) => readCriterion(task1, task1Comments, field.key, field.label));
  const task2Scores = TASK2_FIELDS.map((field) => readCriterion(task2, task2Comments, field.key, field.label));
  if (task1Scores.some((item) => !item) || task2Scores.some((item) => !item)) return null;
  const task1Marked = task1Scores as CriterionScore[];
  const task2Marked = task2Scores as CriterionScore[];
  const task1Justified = task1Marked.every((item) => commentJustifiesBand(item.score, item.comment, scripts?.task1Essay));
  const task2Justified = task2Marked.every((item) => commentJustifiesBand(item.score, item.comment, scripts?.task2Essay));
  if (!task1Justified || !task2Justified) return null;
  const task1Band = averageBand(task1Marked.map((item) => item.score));
  const task2Band = averageBand(task2Marked.map((item) => item.score));
  return {
    status: "marked",
    task1: task1Marked,
    task2: task2Marked,
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
      ? "The Task 1 chart is the attached image. Score Task Achievement from what is actually in the image and the question. Penalise data that is not in the image."
      : chartView === "unseen"
        ? "The Task 1 diagram was not available. You cannot see the chart. Cap Task Achievement at 6.0 and, in the Task Achievement comment, say the diagram was not available. Do not invent chart details."
        : "Task 1 has no chart. Score Task Achievement from the question and the script only.";
  const text = [
    WRITING_RUBRIC,
    chartLine,
    `Task 1 word count: ${countWords(input.task1Essay)}.`,
    `Task 2 word count: ${countWords(input.task2Essay)}.`,
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
  const marked = parseWritingMark(raw, { task1Essay: input.task1Essay, task2Essay: input.task2Essay });
  if (!marked) return null;
  return capUnseenTaskAchievement({ ...marked, chart: request.chart });
}

function mentionsMissingDiagram(comment: string): boolean {
  return /biểu đồ không có|diagram was not available|không được nhìn thấy/i.test(comment);
}

function withDiagramNote(comment: string): string {
  if (mentionsMissingDiagram(comment)) return comment;
  const next = `${comment} ${DIAGRAM_NOTE}`;
  if (next.length <= 600) return next;
  const room = Math.max(0, 600 - DIAGRAM_NOTE.length - 1);
  return `${comment.slice(0, room).trim()} ${DIAGRAM_NOTE}`;
}

/** When the chart was not loaded, Task Achievement cannot sit above 6. */
function capUnseenTaskAchievement(mark: WritingMark): WritingMark {
  if (mark.chart !== "unseen") return mark;
  const task1 = mark.task1.map((item) => {
    if (item.key !== "taskAchievement") return item;
    return {
      ...item,
      score: Math.min(item.score, 6),
      comment: withDiagramNote(item.comment),
    };
  });
  const task1Band = averageBand(task1.map((item) => item.score));
  return {
    ...mark,
    task1,
    task1Band,
    overall: writingOverallBand(task1Band, mark.task2Band),
  };
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
