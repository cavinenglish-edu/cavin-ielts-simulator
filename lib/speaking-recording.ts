export const PART1_DEFAULT_SECONDS = 30;
export const PART2_PREP_SECONDS = 60;
export const PART2_SPEAK_SECONDS = 120;
export const PART3_DEFAULT_SECONDS = 60;

export const RECORDING_LEAVE_WARNING = "Bản ghi sẽ mất nếu bạn tải lại trang hoặc bấm Back.";

export type SpeakingPart = 1 | 2 | 3;

export type SpeakingAnswerBlob = {
  part: SpeakingPart;
  questionIndex: number;
  mimeType: string;
  blob: Blob;
};

export type SpeakingAnswerMeta = {
  part: SpeakingPart;
  questionIndex: number;
  mimeType: string;
};

const AUDIO_BASE = new Set(["audio/webm", "audio/mpeg", "audio/mp4", "audio/ogg"]);

export function answerSeconds(part: 1 | 3, recommendedDurationSeconds?: number): number {
  if (
    typeof recommendedDurationSeconds === "number" &&
    Number.isFinite(recommendedDurationSeconds) &&
    recommendedDurationSeconds > 0
  ) {
    return Math.min(600, Math.floor(recommendedDurationSeconds));
  }
  return part === 1 ? PART1_DEFAULT_SECONDS : PART3_DEFAULT_SECONDS;
}

export function part2Clock(topic: { prepTimeSeconds?: number; speakTimeSeconds?: number }): { prep: number; speak: number } {
  const prep = topic.prepTimeSeconds;
  const speak = topic.speakTimeSeconds;
  return {
    prep: typeof prep === "number" && Number.isFinite(prep) && prep > 0 ? Math.floor(prep) : PART2_PREP_SECONDS,
    speak: typeof speak === "number" && Number.isFinite(speak) && speak > 0 ? Math.floor(speak) : PART2_SPEAK_SECONDS,
  };
}

export function isCaptureActive(phase: "prep" | "recording" | "idle" | "examiner" | "uploading"): boolean {
  return phase === "prep" || phase === "recording";
}

export function appendAnswer(current: SpeakingAnswerBlob[], next: SpeakingAnswerBlob): SpeakingAnswerBlob[] {
  return [...current, next];
}

/** Metadata only. Audio blobs stay in memory and are never written to localStorage. */
export function metadataOnly(answers: SpeakingAnswerBlob[]): SpeakingAnswerMeta[] {
  return answers.map((answer) => ({
    part: answer.part,
    questionIndex: answer.questionIndex,
    mimeType: answer.mimeType,
  }));
}

export function normalizeAudioMime(mime: string): string | null {
  const base = mime.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  if (base === "") return "audio/webm";
  if (!AUDIO_BASE.has(base)) return null;
  return base;
}

export function extensionForMime(mime: string): "webm" | "mp3" | "mp4" | "ogg" | null {
  const normalized = normalizeAudioMime(mime);
  if (normalized === "audio/webm") return "webm";
  if (normalized === "audio/mpeg") return "mp3";
  if (normalized === "audio/mp4") return "mp4";
  if (normalized === "audio/ogg") return "ogg";
  return null;
}

export function speakingObjectKey(input: {
  candidateNumber: string;
  paperId: string;
  part: SpeakingPart;
  questionIndex: number;
  mimeType: string;
  id: string;
}): string | null {
  const ext = extensionForMime(input.mimeType);
  if (!ext) return null;
  const who = input.candidateNumber.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "candidate";
  const paper = input.paperId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "paper";
  const id = input.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "clip";
  return `${who}/${paper}/part-${input.part}-q-${input.questionIndex}-${id}.${ext}`;
}

export function readSpeakingStorageConfig(env: { [key: string]: string | undefined }): { url: string; key: string; bucket: string } | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const bucket = env.SPEAKING_STORAGE_BUCKET?.trim() ?? "";
  if (!url || !key || !bucket) return null;
  return { url, key, bucket };
}

export const SPEAKING_STORAGE_MISSING =
  "Chưa cấu hình kho lưu ghi âm. Bài nói không được lưu.";
