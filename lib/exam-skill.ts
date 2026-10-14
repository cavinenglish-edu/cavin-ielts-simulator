export const SKILLS = ["listening", "reading", "writing", "speaking"] as const;

export type Skill = (typeof SKILLS)[number];

export const SKILL_LABEL: Record<Skill, string> = {
  listening: "Nghe",
  reading: "Đọc",
  writing: "Viết",
  speaking: "Nói",
};

export const EXAMINER_VOICES = [
  { value: "en-GB-RyanNeural", label: "Anh (nam) — Ryan" },
  { value: "en-GB-SoniaNeural", label: "Anh (nữ) — Sonia" },
  { value: "en-GB-ThomasNeural", label: "Anh (nam) — Thomas" },
  { value: "en-AU-NatashaNeural", label: "Úc (nữ) — Natasha" },
  { value: "en-AU-WilliamMultilingualNeural", label: "Úc (nam) — William" },
  { value: "en-US-GuyNeural", label: "Mỹ (nam) — Guy" },
] as const;

export type ExaminerVoice = (typeof EXAMINER_VOICES)[number]["value"];

export const QUESTION_TYPES = [
  "multiple_choice",
  "short_text",
  "true_false_not_given",
  "matching",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Trắc nghiệm một đáp án",
  short_text: "Điền câu trả lời ngắn",
  true_false_not_given: "True / False / Not Given",
  matching: "Matching",
};

export const TFNG_OPTIONS = ["True", "False", "Not Given"] as const;

export const LISTENING_SECONDS = 30 * 60;
export const READING_SECONDS = 60 * 60;
export const WRITING_SECONDS = 60 * 60;
export const WRITING_WORD_TARGETS = { task1: 150, task2: 250 } as const;

export type ObjectiveQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  answer: string;
};

export type ListeningSection = {
  id: string;
  title: string;
  audioUrl: string;
  questions: ObjectiveQuestion[];
};

export type ReadingPassage = {
  id: string;
  title: string;
  text: string;
  questions: ObjectiveQuestion[];
};

export type ListeningPaper = {
  sections: ListeningSection[];
  durationSeconds?: number;
};

export type ReadingPaper = {
  passages: ReadingPassage[];
};

export type WritingPaper = {
  task1: { prompt: string; imageUrl?: string };
  task2: { prompt: string };
};

export function parseSkill(value: unknown): Skill {
  if (value === "listening" || value === "reading" || value === "writing" || value === "speaking") {
    return value;
  }
  return "speaking";
}

export function roomPathForSkill(skill: unknown): string {
  switch (parseSkill(skill)) {
    case "listening":
      return "/exam/listening";
    case "reading":
      return "/exam/reading";
    case "writing":
      return "/exam/writing";
    default:
      return "/exam/room";
  }
}

export function isExaminerVoice(value: string): value is ExaminerVoice {
  return EXAMINER_VOICES.some((voice) => voice.value === value);
}
