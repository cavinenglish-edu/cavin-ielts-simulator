import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  absoluteStorageUrl,
  paperTitleFor,
  retryStoredMark,
  signClipUrls,
  storedClips,
  toAdminDetail,
  toAdminListItem,
  type AdminDetail,
  type AdminListItem,
  type RemarkCode,
} from "@/lib/admin-submission-view";
import { isAdminAuthenticated } from "@/lib/admin-cookie";
import { examTitlesById, getExamRecord } from "@/lib/exam-admin";
import { PRACTICE_MIX_ID } from "@/lib/exam-catalog";
import { FIXTURE_FORECAST_ID, fixtureFullPaper, fixtureSpeaking } from "@/lib/exam-fixture";
import {
  markSpeakingAudio,
  markWritingEssays,
  readModelKey,
  type SpeakingAudioClip,
  type SpeakingQuestionPrompt,
} from "@/lib/exam-marking";
import { getSubmissionById, listEverySubmission, replaceSubmissionMark } from "@/lib/exam-submissions";
import type { SpeakingClip } from "@/lib/exam-submit";
import { readSpeakingClip } from "@/lib/speaking-bytes";
import { readSpeakingStorageConfig } from "@/lib/speaking-recording";
import { speakingExamFromRow, speakingPrompts } from "@/lib/speaking-script";

const MAX_SPEAKING_BYTES = 18 * 1024 * 1024;

export type SubmissionLoad<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "auth" | "missing" | "read"; message: string };

function authFailure(): SubmissionLoad<never> {
  return { ok: false, reason: "auth", message: "Phiên quản trị đã hết hạn. Đăng nhập lại." };
}

async function titlesFor(ids: string[]): Promise<Map<string, string>> {
  if (process.env.E2E_FIXTURE === "1") {
    const titles = new Map<string, string>();
    titles.set(fixtureFullPaper().id, fixtureFullPaper().title);
    titles.set(FIXTURE_FORECAST_ID, fixtureSpeaking("forecast").title);
    return titles;
  }
  return examTitlesById(ids);
}

async function questionsFor(paperId: string): Promise<SpeakingQuestionPrompt[]> {
  if (!paperId || paperId === PRACTICE_MIX_ID) return [];
  if (process.env.E2E_FIXTURE === "1") {
    return speakingPrompts(fixtureSpeaking(paperId === FIXTURE_FORECAST_ID ? "forecast" : "actual"));
  }
  const record = await getExamRecord(paperId);
  if (!record) return [];
  const exam = speakingExamFromRow(record);
  return exam ? speakingPrompts(exam) : [];
}

async function loadAudioClips(clips: SpeakingClip[]): Promise<SpeakingAudioClip[] | null> {
  const ordered = [...clips].sort((a, b) => a.part - b.part || a.questionIndex - b.questionIndex);
  const heard: SpeakingAudioClip[] = [];
  let total = 0;
  for (const clip of ordered) {
    const file = await readSpeakingClip(clip.path);
    if (!file) return null;
    total += file.bytes;
    if (total > MAX_SPEAKING_BYTES) return null;
    heard.push({ part: clip.part, questionIndex: clip.questionIndex, mimeType: file.mimeType, base64: file.base64 });
  }
  return heard.length > 0 ? heard : null;
}

async function signSpeakingPaths(paths: string[]): Promise<Map<string, string>> {
  return signClipUrls(paths, async (safe, expiresIn) => {
    const storage = readSpeakingStorageConfig(process.env);
    if (!storage) return safe.map((path) => ({ path, url: null }));
    try {
      const client = createClient(storage.url, storage.key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
      });
      const signed = await client.storage.from(storage.bucket).createSignedUrls(safe, expiresIn);
      if (signed.error || !signed.data) return safe.map((path) => ({ path, url: null }));
      return signed.data.map((item) => ({
        path: item.path ?? "",
        url: absoluteStorageUrl(item.signedUrl, item.signedURL, storage.url),
      }));
    } catch {
      return safe.map((path) => ({ path, url: null }));
    }
  });
}

export async function loadAdminSubmissionList(): Promise<SubmissionLoad<AdminListItem[]>> {
  if (!(await isAdminAuthenticated())) return authFailure();
  const listed = await listEverySubmission();
  if (!listed.ok) return { ok: false, reason: "read", message: listed.message };
  const titles = await titlesFor(listed.rows.map((row) => row.paperId));
  return { ok: true, data: listed.rows.map((row) => toAdminListItem(row, paperTitleFor(row.paperId, titles))) };
}

export async function loadAdminSubmissionDetail(id: string): Promise<SubmissionLoad<AdminDetail>> {
  if (!(await isAdminAuthenticated())) return authFailure();
  const row = await getSubmissionById(id);
  if (!row) return { ok: false, reason: "missing", message: "Không tìm thấy bài nộp." };
  const titles = await titlesFor([row.paperId]);
  const clips = row.skill === "speaking" ? storedClips(row.payload, row.candidateNumber) : [];
  const audioUrls = clips.length > 0 ? await signSpeakingPaths(clips.map((clip) => clip.path)) : new Map<string, string>();
  const questions = row.skill === "speaking" ? await questionsFor(row.paperId) : [];
  return {
    ok: true,
    data: toAdminDetail({
      row,
      paperTitle: paperTitleFor(row.paperId, titles),
      audioUrls,
      questions,
    }),
  };
}

export async function remarkStoredSubmission(id: string): Promise<{ code: RemarkCode; band?: number }> {
  if (!(await isAdminAuthenticated())) return { code: "denied" };
  const row = await getSubmissionById(id);
  if (!row) return { code: "missing" };
  const result = await retryStoredMark(
    {
      skill: row.skill,
      markingStatus: row.markingStatus,
      candidateNumber: row.candidateNumber,
      paperId: row.paperId,
      payload: row.payload,
    },
    {
      readKey: () => readModelKey(process.env),
      markWriting: markWritingEssays,
      markSpeaking: markSpeakingAudio,
      loadAudio: loadAudioClips,
      questions: questionsFor,
    },
  );
  if (!result.patch) return { code: result.code };
  const written = await replaceSubmissionMark(id, row.markingStatus, result.patch);
  if (written === "updated") return { code: result.code, band: result.band };
  if (written === "conflict") {
    const again = await getSubmissionById(id);
    const score = again && again.markingStatus === "marked" && again.score && typeof again.score === "object"
      ? (again.score as { overall?: unknown }).overall
      : undefined;
    if (typeof score === "number") return { code: "marked", band: score };
  }
  if (result.code === "marked") return { code: "unsaved" };
  return { code: result.code };
}
