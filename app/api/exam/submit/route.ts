import { connection, NextResponse } from "next/server";
import { PRACTICE_MIX_ID, readCatalog } from "@/lib/exam-catalog";
import { FIXTURE_FORECAST_ID, fixtureSpeaking } from "@/lib/exam-fixture";
import { loadFullPaper } from "@/lib/full-paper";
import { examBlanks } from "@/lib/form-table";
import { parseSkill } from "@/lib/exam-skill";
import type { ExamSession } from "@/lib/exam-sitting";
import { supabase } from "@/lib/supabase";
import {
  MARKING_FAILED,
  MISSING_AI_KEY,
  NO_AUDIO,
  markSpeakingAudio,
  markWritingEssays,
  readModelKey,
} from "@/lib/exam-marking";
import { objectiveBand } from "@/lib/ielts-band";
import { readSpeakingClip } from "@/lib/speaking-bytes";
import { speakingExamFromRow, speakingPrompts, type SpeakingPrompt } from "@/lib/speaking-script";
import { saveSubmission } from "@/lib/exam-submissions";
import { cleanAnswerMap, cleanClips, cleanEssay, isSubmitSkill, type SpeakingClip, type SubmitView } from "@/lib/exam-submit";
import { effectiveNow, remainingSeconds } from "@/lib/exam-sitting";
import { countWords, scoreObjective } from "@/lib/ielts-score";
import { readSession } from "@/lib/sitting-cookie";

function candidatePrefix(candidateNumber: string): string {
  return candidateNumber.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "candidate";
}

async function speakingOpen(session: ExamSession): Promise<boolean> {
  if (session.section === "speaking") return true;
  if (process.env.E2E_FIXTURE === "1") return session.paperId === FIXTURE_FORECAST_ID;
  if (!supabase || !session.paperId) return false;
  const selected = await supabase.from("ielts_exams").select("skill, paper").eq("id", session.paperId).eq("status", "published").maybeSingle();
  if (selected.error || !selected.data) return false;
  const row = selected.data as Record<string, unknown>;
  return readCatalog(row.paper, parseSkill(row.skill)) === "forecast";
}

const MAX_SPEAKING_BYTES = 18 * 1024 * 1024;

async function speakingQuestions(paperId: string): Promise<SpeakingPrompt[]> {
  if (paperId === PRACTICE_MIX_ID) return [];
  if (process.env.E2E_FIXTURE === "1") {
    return speakingPrompts(fixtureSpeaking(paperId === FIXTURE_FORECAST_ID ? "forecast" : "actual"));
  }
  if (!supabase || !paperId) return [];
  const selected = await supabase.from("ielts_exams").select("*").eq("id", paperId).eq("status", "published").maybeSingle();
  if (selected.error || !selected.data) return [];
  const exam = speakingExamFromRow(selected.data as Record<string, unknown>);
  return exam ? speakingPrompts(exam) : [];
}

async function heardClips(clips: SpeakingClip[]) {
  if (clips.length === 0) return null;
  const ordered = [...clips].sort((a, b) => a.part - b.part || a.questionIndex - b.questionIndex);
  const heard: Array<{ part: 1 | 2 | 3; questionIndex: number; mimeType: string; base64: string }> = [];
  let total = 0;
  for (const clip of ordered) {
    const file = await readSpeakingClip(clip.path);
    if (!file) return null;
    total += file.bytes;
    if (total > MAX_SPEAKING_BYTES) return null;
    heard.push({ part: clip.part, questionIndex: clip.questionIndex, mimeType: file.mimeType, base64: file.base64 });
  }
  return heard;
}

function sent(extra: Omit<SubmitView, "ok" | "stored" | "message">): SubmitView {
  return { ok: true, stored: true, message: "Bài đã được gửi.", ...extra };
}

export async function POST(request: Request) {
  await connection();
  const session = await readSession();
  if (!session) return NextResponse.json({ ok: false, message: "Hãy nhập mã PIN trước." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bài nộp không đọc được." }, { status: 400 });
  }
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const skill = row && isSubmitSkill(row.skill) ? row.skill : null;
  const allowed = skill === "speaking" ? await speakingOpen(session) : skill === session.section;
  if (!skill || !allowed) {
    return NextResponse.json({ ok: false, message: "Chỉ nộp được kỹ năng đang thi." }, { status: 409 });
  }

  const left = remainingSeconds(session.sectionStartedAt, session.durationSeconds, effectiveNow(Date.now(), session.clockOffsetMs));
  if (skill !== "speaking" && left > 0) {
    return NextResponse.json({ ok: false, message: "Chưa hết giờ." }, { status: 409 });
  }

  const identity = {
    paper_id: session.paperId,
    candidate_number: session.candidateNumber,
    candidate_name: session.name,
    phone: session.phone,
    skill,
    section_started_at: session.sectionStartedAt,
  };

  if (skill === "listening" || skill === "reading") {
    const paper = await loadFullPaper(session.paperId);
    const groups = skill === "listening" ? paper?.listening.sections.flatMap((section) => section.questions) : paper?.reading.passages.flatMap((passage) => passage.questions);
    if (!paper || !groups) return NextResponse.json({ ok: false, message: "Không tìm thấy đề của phiên thi này." }, { status: 404 });
    const allowed = new Set(examBlanks(groups).map((blank) => blank.id));
    const answers = cleanAnswerMap(row?.answers, allowed);
    const objective = scoreObjective(groups, answers);
    const converted = objectiveBand(skill, objective.correct, objective.total);
    const saved = await saveSubmission({
      ...identity,
      payload: { answers },
      score: {
        correct: objective.correct,
        total: objective.total,
        items: objective.items,
        band: converted.band,
        scaledRaw: converted.raw,
        estimated: converted.estimated,
      },
      marking_status: "scored",
    });
    if (!saved.ok) return NextResponse.json({ ok: false, message: saved.message }, { status: 503 });
    // The answer key stays in the saved score. The sitting response does not include it.
    return NextResponse.json(
      sent({
        objective: {
          correct: objective.correct,
          total: objective.total,
          band: converted.band,
          estimated: converted.estimated,
        },
      }),
    );
  }

  if (skill === "writing") {
    const paper = await loadFullPaper(session.paperId);
    if (!paper) return NextResponse.json({ ok: false, message: "Không tìm thấy đề của phiên thi này." }, { status: 404 });
    const task1 = cleanEssay(row?.task1);
    const task2 = cleanEssay(row?.task2);
    const payload = {
      task1: {
        prompt: paper.writing.task1.prompt,
        imageUrl: paper.writing.task1.imageUrl ?? "",
        essay: task1,
        wordCount: countWords(task1),
      },
      task2: {
        prompt: paper.writing.task2.prompt,
        essay: task2,
        wordCount: countWords(task2),
      },
    };
    const key = readModelKey(process.env);
    if (!key) {
      const saved = await saveSubmission({ ...identity, payload, score: null, marking_status: "pending_key" });
      if (!saved.ok) return NextResponse.json({ ok: false, message: saved.message }, { status: 503 });
      return NextResponse.json(sent({ writing: { status: "pending_key", message: MISSING_AI_KEY } }));
    }
    const marked = await markWritingEssays(
      {
        task1Prompt: payload.task1.prompt,
        task1ImageUrl: payload.task1.imageUrl,
        task1Essay: task1,
        task2Prompt: payload.task2.prompt,
        task2Essay: task2,
      },
      key,
    );
    const saved = await saveSubmission({
      ...identity,
      payload,
      score: marked,
      marking_status: marked ? "marked" : "marking_failed",
    });
    if (!saved.ok) return NextResponse.json({ ok: false, message: saved.message }, { status: 503 });
    return NextResponse.json(
      sent({ writing: marked ?? { status: "marking_failed", message: MARKING_FAILED } }),
    );
  }

  const clips = cleanClips(row?.recordings, candidatePrefix(session.candidateNumber));
  const payload = { recordings: clips };
  const key = readModelKey(process.env);
  if (!key) {
    const saved = await saveSubmission({ ...identity, payload, score: null, marking_status: "pending_key" });
    if (!saved.ok) return NextResponse.json({ ok: false, message: saved.message }, { status: 503 });
    return NextResponse.json(sent({ speaking: { status: "pending_key", message: MISSING_AI_KEY } }));
  }
  const audio = await heardClips(clips);
  if (!audio) {
    const saved = await saveSubmission({ ...identity, payload, score: null, marking_status: "no_audio" });
    if (!saved.ok) return NextResponse.json({ ok: false, message: saved.message }, { status: 503 });
    return NextResponse.json(sent({ speaking: { status: "no_audio", message: NO_AUDIO } }));
  }
  const marked = await markSpeakingAudio({ clips: audio, questions: await speakingQuestions(session.paperId) }, key);
  const saved = await saveSubmission({
    ...identity,
    payload,
    score: marked,
    marking_status: marked ? "marked" : "marking_failed",
  });
  if (!saved.ok) return NextResponse.json({ ok: false, message: saved.message }, { status: 503 });
  return NextResponse.json(sent({ speaking: marked ?? { status: "marking_failed", message: MARKING_FAILED } }));
}
