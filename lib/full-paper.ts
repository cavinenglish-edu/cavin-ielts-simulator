import "server-only";
import { chooseMixIds, computerParts, isRetiredSpeakingSet, PRACTICE_MIX_ID, readCatalog } from "@/lib/exam-catalog";
import { FIXTURE_ACTUAL_ID, fixtureFullPaper, type FullPaper } from "@/lib/exam-fixture";
import { FIXTURE_PAPER_ID, listeningSecondsOrDefault } from "@/lib/exam-sitting";
import { parseSkill } from "@/lib/exam-skill";
import type { ClientListening, ClientQuestion, ClientReading, ClientWriting } from "@/lib/exam-paper-view";
import {
  LISTENING_SECONDS,
  QUESTION_TYPES,
  type ListeningPaper,
  type ObjectiveQuestion,
  type QuestionType,
  type ReadingPaper,
  type WritingPaper,
} from "@/lib/exam-skill";
import { supabase } from "@/lib/supabase";

export type { ClientListening, ClientQuestion, ClientReading, ClientWriting };

type ExamRow = {
  id: string;
  title: string | null;
  skill: string | null;
  paper: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readQuestions(value: unknown): ObjectiveQuestion[] {
  if (!Array.isArray(value)) return [];
  const questions: ObjectiveQuestion[] = [];
  for (const item of value) {
    const row = asRecord(item);
    if (!row) continue;
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    const answer = typeof row.answer === "string" ? row.answer.trim() : "";
    if (!prompt || !answer) continue;
    const type = QUESTION_TYPES.includes(row.type as QuestionType) ? (row.type as QuestionType) : "short_text";
    const options = Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === "string" && option.trim().length > 0) : undefined;
    questions.push({
      id: typeof row.id === "string" && row.id.trim() ? row.id : `q_${questions.length + 1}`,
      type,
      prompt,
      options,
      answer,
    });
  }
  return questions;
}

function readListening(paper: unknown): ListeningPaper | null {
  const row = asRecord(paper);
  if (!row) return null;
  const source = Array.isArray(row.sections) ? row : asRecord(row.listening);
  if (!source || !Array.isArray(source.sections)) return null;
  const sections = source.sections.flatMap((item) => {
    const section = asRecord(item);
    if (!section) return [];
    const questions = readQuestions(section.questions);
    const audioUrl = typeof section.audioUrl === "string" ? section.audioUrl.trim() : "";
    if (!audioUrl || questions.length === 0) return [];
    return [
      {
        id: typeof section.id === "string" ? section.id : "section",
        title: typeof section.title === "string" ? section.title : "Section",
        audioUrl,
        questions,
      },
    ];
  });
  if (sections.length === 0) return null;
  const duration = listeningSecondsOrDefault(source.durationSeconds ?? row.durationSeconds);
  return { sections, durationSeconds: duration };
}

function readReading(paper: unknown): ReadingPaper | null {
  const row = asRecord(paper);
  if (!row) return null;
  const source = Array.isArray(row.passages) ? row : asRecord(row.reading);
  if (!source || !Array.isArray(source.passages)) return null;
  const passages = source.passages.flatMap((item) => {
    const passage = asRecord(item);
    if (!passage) return [];
    const text = typeof passage.text === "string" ? passage.text.trim() : "";
    const questions = readQuestions(passage.questions);
    if (!text || questions.length === 0) return [];
    return [
      {
        id: typeof passage.id === "string" ? passage.id : "passage",
        title: typeof passage.title === "string" ? passage.title : "Passage",
        text,
        questions,
      },
    ];
  });
  if (passages.length === 0) return null;
  return { passages };
}

function readWriting(paper: unknown): WritingPaper | null {
  const row = asRecord(paper);
  if (!row) return null;
  const source = asRecord(row.task1) ? row : asRecord(row.writing);
  if (!source) return null;
  const task1 = asRecord(source.task1);
  const task2 = asRecord(source.task2);
  const prompt1 = typeof task1?.prompt === "string" ? task1.prompt.trim() : "";
  const prompt2 = typeof task2?.prompt === "string" ? task2.prompt.trim() : "";
  if (!prompt1 || !prompt2) return null;
  const imageUrl = typeof task1?.imageUrl === "string" ? task1.imageUrl.trim() : "";
  return {
    task1: imageUrl ? { prompt: prompt1, imageUrl } : { prompt: prompt1 },
    task2: { prompt: prompt2 },
  };
}

function fromParts(
  id: string,
  title: string,
  listening: ListeningPaper,
  reading: ReadingPaper,
  writing: WritingPaper,
): FullPaper {
  return {
    id,
    title,
    listeningSeconds: listening.durationSeconds ?? LISTENING_SECONDS,
    listening,
    reading,
    writing,
  };
}

function paperFromRow(row: ExamRow): FullPaper | null {
  const listening = readListening(row.paper);
  const reading = readReading(row.paper);
  const writing = readWriting(row.paper);
  if (!listening || !reading || !writing) return null;
  return fromParts(row.id, row.title?.trim() || "Đề thi", listening, reading, writing);
}

async function loadPracticeMix(): Promise<FullPaper | null> {
  if (!supabase) return null;
  const listed = await supabase.from("ielts_exams").select("id, title, skill, paper").eq("status", "published");
  if (listed.error || !listed.data) return null;
  const rows = (listed.data as ExamRow[]).filter((row) => !isRetiredSpeakingSet(row.id, row.title));
  const chosen = chooseMixIds(
    rows.map((row) => {
      const parts = computerParts(row.paper);
      return {
        id: row.id,
        title: row.title,
        catalog: readCatalog(row.paper, parseSkill(row.skill)),
        ...parts,
      };
    }),
  );
  if (!chosen) return null;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const listeningRow = byId.get(chosen.listeningId);
  const readingRow = byId.get(chosen.readingId);
  const writingRow = byId.get(chosen.writingId);
  const listening = listeningRow ? readListening(listeningRow.paper) : null;
  const reading = readingRow ? readReading(readingRow.paper) : null;
  const writing = writingRow ? readWriting(writingRow.paper) : null;
  if (!listening || !reading || !writing) return null;
  if (new Set([chosen.listeningId, chosen.readingId, chosen.writingId]).size !== 3) return null;
  return fromParts(PRACTICE_MIX_ID, "Luyện trộn", listening, reading, writing);
}

export async function loadFullPaper(paperId: string): Promise<FullPaper | null> {
  if (isRetiredSpeakingSet(paperId)) return null;
  if (process.env.E2E_FIXTURE === "1" && (paperId === FIXTURE_PAPER_ID || paperId === FIXTURE_ACTUAL_ID)) {
    const fixture = fixtureFullPaper();
    return paperId === FIXTURE_PAPER_ID ? fixture : { ...fixture, id: FIXTURE_ACTUAL_ID, title: "Actual Harbour Sitting" };
  }
  if (paperId === PRACTICE_MIX_ID) return loadPracticeMix();
  if (!supabase || !paperId) return null;
  const selected = await supabase
    .from("ielts_exams")
    .select("id, title, skill, paper, status")
    .eq("id", paperId)
    .eq("status", "published")
    .maybeSingle();
  if (selected.error || !selected.data) return null;
  const row = selected.data as ExamRow;
  if (isRetiredSpeakingSet(row.id, row.title)) return null;
  return paperFromRow(row);
}

function stripQuestion(question: ObjectiveQuestion): ClientQuestion {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    ...(question.options ? { options: question.options } : {}),
  };
}

export function clientListening(paper: FullPaper): ClientListening {
  return {
    title: paper.title,
    durationSeconds: paper.listeningSeconds,
    sections: paper.listening.sections.map((section) => ({
      id: section.id,
      title: section.title,
      audioUrl: section.audioUrl,
      questions: section.questions.map(stripQuestion),
    })),
  };
}

export function clientReading(paper: FullPaper): ClientReading {
  return {
    title: paper.title,
    passages: paper.reading.passages.map((passage) => ({
      id: passage.id,
      title: passage.title,
      text: passage.text,
      questions: passage.questions.map(stripQuestion),
    })),
  };
}

export function clientWriting(paper: FullPaper): ClientWriting {
  return {
    title: paper.title,
    task1: paper.writing.task1,
    task2: paper.writing.task2,
  };
}
