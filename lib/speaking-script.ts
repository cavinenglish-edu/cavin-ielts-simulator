import type { ExamDataSet } from "@/data/exam_data";
import { isRetiredSpeakingSet, readCatalog } from "@/lib/exam-catalog";
import { parseSkill } from "@/lib/exam-skill";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type SpeakingPrompt = {
  part: 1 | 2 | 3;
  questionIndex: number;
  question: string;
};

export function speakingPrompts(exam: ExamDataSet): SpeakingPrompt[] {
  const prompts: SpeakingPrompt[] = exam.part1.questions.map((item, questionIndex) => ({
    part: 1,
    questionIndex,
    question: item.question,
  }));
  const cue = [exam.part2.topicTitle, exam.part2.taskCardPrompt, ...exam.part2.bulletPoints].filter((line) => line.trim()).join("\n");
  prompts.push({ part: 2, questionIndex: 0, question: cue || exam.part2.topicTitle });
  exam.part3.questions.forEach((item, questionIndex) => {
    prompts.push({ part: 3, questionIndex, question: item.question });
  });
  return prompts;
}

export function speakingExamFromRow(row: Record<string, unknown>): ExamDataSet | null {
  const id = text(row.id);
  const title = text(row.title) || "Đề thi";
  if (!id || isRetiredSpeakingSet(id, title)) return null;
  const topics = Array.isArray(row.part1_topics) ? row.part1_topics : [];
  const part1Questions = topics.flatMap((topic) => {
    const item = asRecord(topic);
    const questions = Array.isArray(item?.questions) ? item.questions : [];
    return questions.map((question) => text(question)).filter(Boolean);
  });
  if (part1Questions.length === 0) return null;
  const part2 = asRecord(row.part2_topic);
  const cueImage = text(part2?.imageUrl);
  const part3 = Array.isArray(row.part3_questions) ? row.part3_questions : [];
  const examinerName = text(row.examiner_name) || "Examiner";
  const catalog = readCatalog(row.paper, parseSkill(row.skill));
  const voice = text(row.examiner_voice);
  return {
    id,
    title,
    category: catalog === "forecast" ? "Forecast" : "Actual",
    season: text(row.season),
    examinerName,
    examinerRole: text(row.examiner_role) || "Examiner",
    examinerVoice: voice === "en-US" || voice === "en-AU" || voice === "en-GB" ? voice : "en-GB",
    part1: {
      welcome: `Good afternoon. My name is ${examinerName}. Could you tell me your full name, please?`,
      questions: part1Questions.map((question, index) => ({
        id: `p1_${index + 1}`,
        question,
        recommendedDurationSeconds: 30,
      })),
    },
    part2: {
      id: "p2",
      topicTitle: text(part2?.title) || title,
      taskCardPrompt: text(part2?.content) || "You should say:",
      bulletPoints: Array.isArray(part2?.bulletPoints) ? part2.bulletPoints.map((item) => text(item)).filter(Boolean) : [],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
      ...(cueImage ? { imageUrl: cueImage } : {}),
    },
    part3: {
      topicIntro: `We've been talking about ${text(part2?.title) || "this topic"}, and I'd like to ask you some more general questions.`,
      questions: part3
        .map((question, index) => ({
          id: text(asRecord(question)?.id) || `p3_${index + 1}`,
          question: text(asRecord(question)?.question),
          recommendedDurationSeconds:
            Number.isFinite(Number(asRecord(question)?.recommendedDurationSeconds)) &&
            Number(asRecord(question)?.recommendedDurationSeconds) > 0
              ? Math.floor(Number(asRecord(question)?.recommendedDurationSeconds))
              : 60,
        }))
        .filter((question) => question.question),
    },
  };
}
