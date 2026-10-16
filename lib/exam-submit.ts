import type { Skill } from "@/lib/exam-skill";
import type { ScoreItem } from "@/lib/ielts-score";
import type { SpeakingMark, WritingMark } from "@/lib/exam-marking";

export type MarkingGap = {
  status: "pending_key" | "no_transcript" | "no_audio" | "marking_failed";
  message: string;
};

export type ObjectiveScoreView = {
  correct: number;
  total: number;
  band: number;
  estimated: boolean;
  items?: ScoreItem[];
};

export type SubmitView = {
  ok: boolean;
  stored?: boolean;
  message: string;
  objective?: ObjectiveScoreView;
  writing?: WritingMark | MarkingGap;
  speaking?: SpeakingMark | MarkingGap;
};

export type SpeakingClip = {
  part: 1 | 2 | 3;
  questionIndex: number;
  path: string;
  transcript: string;
};

const CLIP_PATH = /^[a-zA-Z0-9_-]{1,40}\/[a-zA-Z0-9_-]{1,80}\/part-[123]-q-\d{1,2}-[a-zA-Z0-9_-]{1,40}\.(webm|mp3|mp4|ogg)$/;

export function isSubmitSkill(value: unknown): value is Exclude<Skill, never> {
  return value === "listening" || value === "reading" || value === "writing" || value === "speaking";
}

export function cleanAnswerMap(value: unknown, allowed: ReadonlySet<string>): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const answers: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!allowed.has(key) || typeof raw !== "string") continue;
    answers[key] = raw.slice(0, 500);
  }
  return answers;
}

export function cleanEssay(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 20000) : "";
}

export function cleanClips(value: unknown, candidatePrefix: string): SpeakingClip[] {
  if (!Array.isArray(value)) return [];
  const clips: SpeakingClip[] = [];
  for (const item of value.slice(0, 30)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const part = row.part === 1 || row.part === 2 || row.part === 3 ? row.part : null;
    const questionIndex = typeof row.questionIndex === "number" ? row.questionIndex : Number.NaN;
    const path = typeof row.path === "string" ? row.path : "";
    if (!part || !Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 19) continue;
    if (!CLIP_PATH.test(path) || !path.startsWith(`${candidatePrefix}/`)) continue;
    const transcript = typeof row.transcript === "string" ? row.transcript.slice(0, 8000) : "";
    clips.push({ part, questionIndex, path, transcript });
  }
  return clips;
}
