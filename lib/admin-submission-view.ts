import { PRACTICE_MIX_ID } from "@/lib/exam-catalog";
import {
  MARKING_FAILED,
  MISSING_AI_KEY,
  NO_AUDIO,
  NO_TRANSCRIPT,
  type SpeakingAudioClip,
  type SpeakingMark,
  type SpeakingQuestionPrompt,
  type WritingMark,
} from "@/lib/exam-marking";
import { SKILL_LABEL, type Skill } from "@/lib/exam-skill";
import { countWords } from "@/lib/ielts-score";
import { cleanClips, isSpeakingClipPath, speakingCandidatePrefix, type SpeakingClip } from "@/lib/exam-submit";

export const UNMARKED_RESULT = "chưa chấm được";
export const SIGNED_AUDIO_TTL_SECONDS = 900;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RemarkCode = "marked" | "no_key" | "no_audio" | "failed" | "denied" | "missing" | "unsaved";

export type RemarkStatus = "scored" | "marked" | "pending_key" | "no_transcript" | "no_audio" | "marking_failed" | "saved";

export type ParsedSubmission = {
  id: string;
  paperId: string;
  candidateNumber: string;
  candidateName: string;
  skill: string;
  sectionStartedAt: number;
  payload: unknown;
  score: unknown;
  markingStatus: string;
  createdAt: string | null;
};

export type AdminListItem = {
  id: string;
  candidateName: string;
  candidateNumber: string;
  paperTitle: string;
  skill: Skill | null;
  skillLabel: string;
  timeLabel: string;
  timeIso: string;
  resultLabel: string;
  canRemark: boolean;
};

export type AnswerView = {
  id: string;
  prompt: string;
  given: string;
  expected: string;
  ok: boolean | null;
};

export type EssayView = {
  task: string;
  prompt: string;
  essay: string;
  wordCount: number;
  imageUrl: string;
};

export type CriterionView = {
  key: string;
  label: string;
  score: number;
  comment: string;
};

export type AudioView = {
  path: string;
  label: string;
  url: string | null;
};

export type AdminDetail = {
  id: string;
  candidateName: string;
  candidateNumber: string;
  paperTitle: string;
  skill: Skill | null;
  skillLabel: string;
  timeLabel: string;
  timeIso: string;
  resultLabel: string;
  canRemark: boolean;
  note: string;
  chartNote: string;
  answers: AnswerView[];
  essays: EssayView[];
  criteria: CriterionView[];
  clips: AudioView[];
};

export type RemarkPatch = {
  score: object | null;
  marking_status: RemarkStatus;
};

export type RemarkResult = {
  code: RemarkCode;
  message: string;
  patch: RemarkPatch | null;
  band?: number;
};

type RemarkRow = {
  skill: string;
  markingStatus: string;
  candidateNumber: string;
  paperId: string;
  payload: unknown;
};

export type RemarkIO = {
  readKey: () => string | null;
  markWriting: (
    input: {
      task1Prompt: string;
      task1ImageUrl?: string;
      task1Essay: string;
      task2Prompt: string;
      task2Essay: string;
    },
    key: string,
  ) => Promise<WritingMark | null>;
  markSpeaking: (
    input: { clips: SpeakingAudioClip[]; questions: SpeakingQuestionPrompt[] },
    key: string,
  ) => Promise<SpeakingMark | null>;
  loadAudio: (clips: SpeakingClip[]) => Promise<SpeakingAudioClip[] | null>;
  questions: (paperId: string) => Promise<SpeakingQuestionPrompt[]>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function knownSkill(value: string): Skill | null {
  if (value === "listening" || value === "reading" || value === "writing" || value === "speaking") return value;
  return null;
}

export function canRemarkSubmission(skill: string, status: string): boolean {
  if (skill !== "writing" && skill !== "speaking") return false;
  return status !== "marked" && status !== "scored";
}

function bandText(value: number): string {
  return value.toFixed(1);
}

export function submissionResultLabel(input: { skill: string; markingStatus: string; score: unknown }): string {
  const score = asRecord(input.score);
  if (input.skill === "listening" || input.skill === "reading") {
    const correct = typeof score?.correct === "number" ? score.correct : null;
    const total = typeof score?.total === "number" ? score.total : null;
    const band = typeof score?.band === "number" ? score.band : null;
    if (correct === null || total === null) return UNMARKED_RESULT;
    const ratio = `${correct}/${total}`;
    if (band === null) return ratio;
    const estimate = score?.estimated === true ? " (ước lượng)" : "";
    return `${ratio} · band ${bandText(band)}${estimate}`;
  }
  if (input.markingStatus === "marked" && typeof score?.overall === "number") {
    return `Band ${bandText(score.overall)}`;
  }
  return UNMARKED_RESULT;
}

export function submissionNote(status: string): string {
  if (status === "pending_key") return MISSING_AI_KEY;
  if (status === "no_audio") return NO_AUDIO;
  if (status === "no_transcript") return NO_TRANSCRIPT;
  if (status === "marking_failed" || status === "saved") return UNMARKED_RESULT;
  return "";
}

export function chartNote(score: unknown): string {
  return asRecord(score)?.chart === "unseen" ? "Biểu đồ Task 1 không được nhìn thấy khi chấm." : "";
}

export function formatSubmissionTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function paperTitleFor(paperId: string, titles: ReadonlyMap<string, string>): string {
  if (paperId === PRACTICE_MIX_ID) return "Luyện trộn";
  const title = titles.get(paperId)?.trim();
  return title || "Đề không còn trong thư viện";
}

export function parseSubmissionRecord(value: unknown): ParsedSubmission | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || !UUID.test(row.id)) return null;
  if (typeof row.paper_id !== "string" || typeof row.candidate_number !== "string" || typeof row.skill !== "string") return null;
  const started = typeof row.section_started_at === "number" ? row.section_started_at : Number(row.section_started_at);
  if (!Number.isFinite(started)) return null;
  const createdAt = typeof row.created_at === "string" && !Number.isNaN(Date.parse(row.created_at))
    ? new Date(row.created_at).toISOString()
    : new Date(started).toISOString();
  return {
    id: row.id,
    paperId: row.paper_id,
    candidateNumber: row.candidate_number,
    candidateName: typeof row.candidate_name === "string" ? row.candidate_name : "",
    skill: row.skill,
    sectionStartedAt: started,
    payload: row.payload ?? {},
    score: row.score ?? null,
    markingStatus: typeof row.marking_status === "string" ? row.marking_status : "saved",
    createdAt,
  };
}

function timeFields(row: { createdAt: string | null; sectionStartedAt: number }): { timeIso: string; timeLabel: string } {
  const timeIso = row.createdAt && !Number.isNaN(Date.parse(row.createdAt))
    ? new Date(row.createdAt).toISOString()
    : new Date(row.sectionStartedAt).toISOString();
  return { timeIso, timeLabel: formatSubmissionTime(timeIso) };
}

export function toAdminListItem(row: ParsedSubmission, paperTitle: string): AdminListItem {
  const skill = knownSkill(row.skill);
  const time = timeFields(row);
  return {
    id: row.id,
    candidateName: row.candidateName.trim() || "Thí sinh",
    candidateNumber: row.candidateNumber,
    paperTitle,
    skill,
    skillLabel: skill ? SKILL_LABEL[skill] : "—",
    timeLabel: time.timeLabel,
    timeIso: time.timeIso,
    resultLabel: submissionResultLabel({ skill: row.skill, markingStatus: row.markingStatus, score: row.score }),
    canRemark: canRemarkSubmission(row.skill, row.markingStatus),
  };
}

function readCriteria(value: unknown, prefix: string): CriterionView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.key !== "string" || typeof row.label !== "string") return [];
    if (typeof row.score !== "number" || typeof row.comment !== "string") return [];
    return [{ key: `${prefix}${row.key}`, label: prefix ? `${prefix}${row.label}` : row.label, score: row.score, comment: row.comment }];
  });
}

export function criteriaViews(skill: string, score: unknown): CriterionView[] {
  const row = asRecord(score);
  if (!row || skill === "listening" || skill === "reading") return [];
  if (skill === "writing") return [...readCriteria(row.task1, "Task 1 · "), ...readCriteria(row.task2, "Task 2 · ")];
  return readCriteria(row.criteria, "");
}

export function answerViews(score: unknown, payload: unknown): AnswerView[] {
  const items = asRecord(score)?.items;
  if (Array.isArray(items)) {
    const parsed = items.flatMap((item) => {
      const row = asRecord(item);
      if (!row || typeof row.id !== "string") return [];
      return [{
        id: row.id,
        prompt: typeof row.prompt === "string" ? row.prompt : row.id,
        given: typeof row.given === "string" ? row.given : "",
        expected: typeof row.expected === "string" ? row.expected : "",
        ok: typeof row.ok === "boolean" ? row.ok : null,
      }];
    });
    if (parsed.length > 0) return parsed;
  }
  const answers = asRecord(asRecord(payload)?.answers);
  if (!answers) return [];
  return Object.entries(answers).flatMap(([id, given]) => {
    if (typeof given !== "string") return [];
    return [{ id, prompt: id, given, expected: "", ok: null }];
  });
}

export function essayViews(payload: unknown): EssayView[] {
  const row = asRecord(payload);
  const task1 = asRecord(row?.task1);
  const task2 = asRecord(row?.task2);
  if (!task1 && !task2) return [];
  const essay1 = typeof task1?.essay === "string" ? task1.essay : "";
  const essay2 = typeof task2?.essay === "string" ? task2.essay : "";
  return [
    {
      task: "Task 1",
      prompt: typeof task1?.prompt === "string" ? task1.prompt : "",
      essay: essay1,
      wordCount: countWords(essay1),
      imageUrl: typeof task1?.imageUrl === "string" ? task1.imageUrl : "",
    },
    {
      task: "Task 2",
      prompt: typeof task2?.prompt === "string" ? task2.prompt : "",
      essay: essay2,
      wordCount: countWords(essay2),
      imageUrl: "",
    },
  ];
}

export function storedClips(payload: unknown, candidateNumber: string): SpeakingClip[] {
  return cleanClips(asRecord(payload)?.recordings, speakingCandidatePrefix(candidateNumber));
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function signClipUrls(
  paths: string[],
  signer: (paths: string[], expiresIn: number) => Promise<Array<{ path: string; url: string | null }>>,
): Promise<Map<string, string>> {
  const safe = [...new Set(paths.filter((path) => isSpeakingClipPath(path)))];
  const urls = new Map<string, string>();
  if (safe.length === 0) return urls;
  const signed = await signer(safe, SIGNED_AUDIO_TTL_SECONDS);
  const allowed = new Set(safe);
  for (const item of signed) {
    if (!allowed.has(item.path) || !item.url || !isHttpsUrl(item.url)) continue;
    urls.set(item.path, item.url);
  }
  return urls;
}

function clipLabel(part: number, questionIndex: number, questions: SpeakingQuestionPrompt[]): string {
  const question = questions.find((item) => item.part === part && item.questionIndex === questionIndex)?.question.trim() ?? "";
  const heading = `Part ${part} · câu ${questionIndex + 1}`;
  return question ? `${heading}: ${question}` : heading;
}

export function toAdminDetail(input: {
  row: ParsedSubmission;
  paperTitle: string;
  audioUrls: ReadonlyMap<string, string>;
  questions: SpeakingQuestionPrompt[];
}): AdminDetail {
  const list = toAdminListItem(input.row, input.paperTitle);
  const clips = input.row.skill === "speaking"
    ? storedClips(input.row.payload, input.row.candidateNumber).map((clip) => ({
      path: clip.path,
      label: clipLabel(clip.part, clip.questionIndex, input.questions),
      url: input.audioUrls.get(clip.path) ?? null,
    }))
    : [];
  return {
    id: list.id,
    candidateName: list.candidateName,
    candidateNumber: list.candidateNumber,
    paperTitle: list.paperTitle,
    skill: list.skill,
    skillLabel: list.skillLabel,
    timeLabel: list.timeLabel,
    timeIso: list.timeIso,
    resultLabel: list.resultLabel,
    canRemark: list.canRemark,
    note: submissionNote(input.row.markingStatus),
    chartNote: input.row.skill === "writing" ? chartNote(input.row.score) : "",
    answers: input.row.skill === "listening" || input.row.skill === "reading" ? answerViews(input.row.score, input.row.payload) : [],
    essays: input.row.skill === "writing" ? essayViews(input.row.payload) : [],
    criteria: criteriaViews(input.row.skill, input.row.score),
    clips,
  };
}

function writingMarkInput(payload: unknown): {
  task1Prompt: string;
  task1ImageUrl?: string;
  task1Essay: string;
  task2Prompt: string;
  task2Essay: string;
} | null {
  const row = asRecord(payload);
  const task1 = asRecord(row?.task1);
  const task2 = asRecord(row?.task2);
  if (!task1 || !task2) return null;
  return {
    task1Prompt: typeof task1.prompt === "string" ? task1.prompt : "",
    task1ImageUrl: typeof task1.imageUrl === "string" ? task1.imageUrl : "",
    task1Essay: typeof task1.essay === "string" ? task1.essay : "",
    task2Prompt: typeof task2.prompt === "string" ? task2.prompt : "",
    task2Essay: typeof task2.essay === "string" ? task2.essay : "",
  };
}

function failed(code: RemarkCode, message: string, marking_status: RemarkStatus): RemarkResult {
  return { code, message, patch: { score: null, marking_status } };
}

export async function retryStoredMark(row: RemarkRow, io: RemarkIO): Promise<RemarkResult> {
  if (!canRemarkSubmission(row.skill, row.markingStatus)) {
    return { code: "denied", message: "Không chấm lại bài này.", patch: null };
  }
  const key = io.readKey();
  if (!key) return failed("no_key", MISSING_AI_KEY, "pending_key");

  if (row.skill === "writing") {
    const input = writingMarkInput(row.payload);
    if (!input) return failed("failed", MARKING_FAILED, "marking_failed");
    let marked: WritingMark | null = null;
    try {
      marked = await io.markWriting(input, key);
    } catch {
      marked = null;
    }
    if (!marked) return failed("failed", MARKING_FAILED, "marking_failed");
    return {
      code: "marked",
      message: `Đã chấm lại. Band ${bandText(marked.overall)}.`,
      patch: { score: marked, marking_status: "marked" },
      band: marked.overall,
    };
  }

  const clips = storedClips(row.payload, row.candidateNumber);
  let audio: SpeakingAudioClip[] | null = null;
  if (clips.length > 0) {
    try {
      audio = await io.loadAudio(clips);
    } catch {
      audio = null;
    }
  }
  if (!audio || audio.length === 0) return failed("no_audio", NO_AUDIO, "no_audio");
  let questions: SpeakingQuestionPrompt[] = [];
  try {
    questions = await io.questions(row.paperId);
  } catch {
    questions = [];
  }
  let marked: SpeakingMark | null = null;
  try {
    marked = await io.markSpeaking({ clips: audio, questions }, key);
  } catch {
    marked = null;
  }
  if (!marked) return failed("failed", MARKING_FAILED, "marking_failed");
  return {
    code: "marked",
    message: `Đã chấm lại. Band ${bandText(marked.overall)}.`,
    patch: { score: marked, marking_status: "marked" },
    band: marked.overall,
  };
}

export function remarkNotice(code: string | undefined, band: string | undefined): { tone: "ok" | "err"; text: string } | null {
  if (code === "marked") {
    const numeric = band === undefined || band === "" ? null : Number(band);
    const safe = numeric !== null && Number.isFinite(numeric) && numeric >= 0 && numeric <= 9 && Math.abs(numeric * 2 - Math.round(numeric * 2)) < 0.001;
    return { tone: "ok", text: safe ? `Đã chấm lại. Band ${bandText(numeric)}.` : "Đã chấm lại." };
  }
  if (code === "no_key") return { tone: "err", text: MISSING_AI_KEY };
  if (code === "no_audio") return { tone: "err", text: NO_AUDIO };
  if (code === "failed") return { tone: "err", text: MARKING_FAILED };
  if (code === "unsaved") return { tone: "err", text: "Chưa lưu được kết quả chấm." };
  if (code === "denied") return { tone: "err", text: "Không chấm lại bài này." };
  if (code === "missing") return { tone: "err", text: "Không tìm thấy bài nộp." };
  return null;
}

export function absoluteStorageUrl(signedUrl: string | null, signedPath: string | null, supabaseUrl: string): string | null {
  if (signedUrl && isHttpsUrl(signedUrl)) return signedUrl;
  if (!signedPath || !signedPath.startsWith("/") || signedPath.startsWith("//")) return null;
  const base = supabaseUrl.trim().replace(/\/$/, "");
  if (!base.startsWith("https://")) return null;
  const absolute = signedPath.startsWith("/storage/") ? `${base}${signedPath}` : `${base}/storage/v1${signedPath}`;
  return isHttpsUrl(absolute) ? absolute : null;
}
