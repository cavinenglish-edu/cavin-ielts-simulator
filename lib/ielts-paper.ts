import { z } from "zod";
import {
  EXAMINER_VOICES,
  QUESTION_TYPES,
  TFNG_OPTIONS,
  isExaminerVoice,
  parseSkill,
  type ExaminerVoice,
  type ListeningPaper,
  type ObjectiveQuestion,
  type QuestionType,
  type ReadingPaper,
  type Skill,
  type WritingPaper,
} from "@/lib/exam-skill";
import { normalizeAnswer } from "@/lib/ielts-score";

const voiceValues = EXAMINER_VOICES.map((voice) => voice.value) as [ExaminerVoice, ...ExaminerVoice[]];

const questionSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.enum(QUESTION_TYPES),
    prompt: z.string().trim().min(1, "Nhập nội dung câu hỏi"),
    options: z.array(z.string().trim().min(1)).optional(),
    answer: z.string().trim().min(1, "Nhập đáp án"),
  })
  .superRefine((question, ctx) => {
    if (question.type === "multiple_choice" || question.type === "matching") {
      if (!question.options || question.options.length < 2) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "Cần ít nhất 2 phương án" });
        return;
      }
      const matched = question.options.some((option) => normalizeAnswer(option) === normalizeAnswer(question.answer));
      if (!matched) {
        ctx.addIssue({ code: "custom", path: ["answer"], message: "Đáp án phải trùng một phương án" });
      }
    }
    if (question.type === "true_false_not_given") {
      const allowed = TFNG_OPTIONS.some((option) => option.toLowerCase() === question.answer.toLowerCase());
      if (!allowed) {
        ctx.addIssue({
          code: "custom",
          path: ["answer"],
          message: "Đáp án phải là True, False hoặc Not Given",
        });
      }
    }
  });

const listeningSchema = z.object({
  id: z.string().uuid("Mã đề không hợp lệ").optional(),
  skill: z.literal("listening"),
  title: z.string().trim().min(1, "Nhập tiêu đề đề thi"),
  season: z.string().trim().optional(),
  status: z.enum(["draft", "published"]),
  accessCode: z.string().trim().max(64).optional(),
  durationSeconds: z.number().int().positive().max(7200).optional(),
  sections: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1, "Nhập tên section"),
        audioUrl: z.url("Cần URL audio hợp lệ"),
        questions: z.array(questionSchema).min(1, "Mỗi section cần ít nhất một câu hỏi").max(40),
      }),
    )
    .min(1, "Cần ít nhất một section")
    .max(4, "Listening có tối đa 4 section"),
});

const readingSchema = z.object({
  id: z.string().uuid("Mã đề không hợp lệ").optional(),
  skill: z.literal("reading"),
  title: z.string().trim().min(1, "Nhập tiêu đề đề thi"),
  season: z.string().trim().optional(),
  status: z.enum(["draft", "published"]),
  accessCode: z.string().trim().max(64).optional(),
  passages: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1, "Nhập tiêu đề đoạn văn"),
        text: z.string().trim().min(1, "Nhập nội dung đoạn văn").max(20000),
        questions: z.array(questionSchema).min(1, "Mỗi đoạn văn cần ít nhất một câu hỏi").max(40),
      }),
    )
    .min(1, "Cần ít nhất một đoạn văn")
    .max(3, "Reading Academic có tối đa 3 đoạn"),
});

const writingSchema = z.object({
  id: z.string().uuid("Mã đề không hợp lệ").optional(),
  skill: z.literal("writing"),
  title: z.string().trim().min(1, "Nhập tiêu đề đề thi"),
  season: z.string().trim().optional(),
  status: z.enum(["draft", "published"]),
  accessCode: z.string().trim().max(64).optional(),
  task1Prompt: z.string().trim().min(1, "Nhập đề Task 1").max(20000),
  task1ImageUrl: z.union([z.literal(""), z.url("URL hình Task 1 không hợp lệ")]).optional(),
  task2Prompt: z.string().trim().min(1, "Nhập đề Task 2").max(20000),
});

const speakingSchema = z.object({
  id: z.string().uuid("Mã đề không hợp lệ").optional(),
  skill: z.literal("speaking"),
  title: z.string().trim().min(1, "Nhập tiêu đề đề thi"),
  season: z.string().trim().optional(),
  status: z.enum(["draft", "published"]),
  accessCode: z.string().trim().max(64).optional(),
  examinerName: z.string().trim().min(2, "Nhập tên giám khảo"),
  examinerVoice: z.enum(voiceValues),
  examinerRole: z.string().trim().min(1).optional(),
  examinerAvatar: z.string().trim().min(1).optional(),
  part2Content: z.string().trim().min(1).optional(),
  part1Questions: z.array(z.string().trim().min(1, "Nhập câu hỏi Part 1")).min(1, "Cần ít nhất một câu Part 1").max(20),
  part2Prompt: z.string().trim().min(1, "Nhập đề cue card Part 2"),
  part2Bullets: z.array(z.string().trim().min(1, "Nhập ý bullet Part 2")).min(1, "Cần ít nhất một ý Part 2").max(8),
  part3Questions: z.array(z.string().trim().min(1, "Nhập câu hỏi Part 3")).min(1, "Cần ít nhất một câu Part 3").max(20),
});

export const paperInputSchema = z.discriminatedUnion("skill", [
  listeningSchema,
  readingSchema,
  writingSchema,
  speakingSchema,
]);

export type PaperInput = z.infer<typeof paperInputSchema>;

export type IeltsExamWrite = {
  title: string;
  season: string;
  examiner_name: string;
  examiner_role: string;
  examiner_avatar: string;
  examiner_voice: string;
  status: "draft" | "published";
  skill: Skill;
  paper: ListeningPaper | ReadingPaper | WritingPaper | Record<string, never>;
  part1_topics: Array<{ id: string; title: string; questions: string[] }>;
  part2_topic: { id: string; title: string; content: string; bulletPoints: string[] } | Record<string, never>;
  part3_questions: Array<{ id: string; question: string }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalTfng(answer: string): string {
  const normalized = normalizeAnswer(answer);
  if (normalized === "true" || normalized === "t") return "True";
  if (normalized === "false" || normalized === "f") return "False";
  if (normalized === "not given" || normalized === "ng") return "Not Given";
  return answer.trim();
}

function prepareQuestion(value: unknown): ObjectiveQuestion | null {
  const row = asRecord(value);
  if (!row) return null;
  const prompt = text(row.prompt);
  const rawAnswer = text(row.answer);
  if (!prompt && !rawAnswer) return null;
  const type = QUESTION_TYPES.includes(row.type as QuestionType) ? (row.type as QuestionType) : "short_text";
  let options = Array.isArray(row.options) ? row.options.map((option) => text(option)).filter(Boolean) : [];
  let answer = rawAnswer;
  if (type === "true_false_not_given") {
    options = [...TFNG_OPTIONS];
    answer = canonicalTfng(answer);
  } else if (type === "multiple_choice" || type === "matching") {
    const letter = normalizeAnswer(answer);
    if (letter.length === 1) {
      const index = letter.charCodeAt(0) - 97;
      if (index >= 0 && index < options.length) answer = options[index];
    }
    const matched = options.find((option) => normalizeAnswer(option) === normalizeAnswer(answer));
    if (matched) answer = matched;
  } else {
    options = [];
  }
  const id = text(row.id) || `q_${Math.random().toString(36).slice(2, 10)}`;
  return { id, type, prompt, options, answer };
}

function prepareQuestions(value: unknown): ObjectiveQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.map(prepareQuestion).filter((question): question is ObjectiveQuestion => question !== null);
}

export function preparePaperInput(input: unknown): unknown {
  const row = asRecord(input);
  if (!row) return input;
  const skill = text(row.skill);
  const id = text(row.id);
  const base: Record<string, unknown> = { ...row };
  if (id) base.id = id;
  else delete base.id;

  if (skill === "listening" && Array.isArray(row.sections)) {
    return {
      ...base,
      sections: row.sections.map((section, index) => {
        const item = asRecord(section) ?? {};
        return {
          id: text(item.id) || `section-${index + 1}`,
          title: text(item.title) || `Section ${index + 1}`,
          audioUrl: text(item.audioUrl),
          questions: prepareQuestions(item.questions),
        };
      }),
    };
  }

  if (skill === "reading" && Array.isArray(row.passages)) {
    return {
      ...base,
      passages: row.passages.map((passage, index) => {
        const item = asRecord(passage) ?? {};
        return {
          id: text(item.id) || `passage-${index + 1}`,
          title: text(item.title) || `Passage ${index + 1}`,
          text: text(item.text),
          questions: prepareQuestions(item.questions),
        };
      }),
    };
  }

  if (skill === "writing") {
    return {
      ...base,
      task1Prompt: text(row.task1Prompt),
      task1ImageUrl: text(row.task1ImageUrl),
      task2Prompt: text(row.task2Prompt),
    };
  }

  if (skill === "speaking") {
    const cleanList = (value: unknown): string[] =>
      Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
    const role = text(row.examinerRole);
    const avatar = text(row.examinerAvatar);
    const part2Content = text(row.part2Content);
    const speaking: Record<string, unknown> = {
      ...base,
      examinerName: text(row.examinerName),
      examinerVoice: text(row.examinerVoice),
      part1Questions: cleanList(row.part1Questions),
      part2Prompt: text(row.part2Prompt),
      part2Bullets: cleanList(row.part2Bullets),
      part3Questions: cleanList(row.part3Questions),
    };
    if (role) speaking.examinerRole = role;
    else delete speaking.examinerRole;
    if (avatar) speaking.examinerAvatar = avatar;
    else delete speaking.examinerAvatar;
    if (part2Content) speaking.part2Content = part2Content;
    else delete speaking.part2Content;
    return speaking;
  }

  return base;
}

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
    const current = fieldErrors[path] ?? [];
    current.push(issue.message);
    fieldErrors[path] = current;
  }
  return fieldErrors;
}

function withAccessCode<T extends Record<string, unknown>>(paper: T, code: string | undefined): T {
  const trimmed = code?.trim();
  if (!trimmed) return paper;
  return { ...paper, accessCode: trimmed } as T;
}

function avatarFor(name: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
}

export function toDbRow(input: PaperInput): IeltsExamWrite {
  if (input.skill === "speaking") {
    return {
      title: input.title,
      season: input.season?.trim() || "Forecast",
      examiner_name: input.examinerName,
      examiner_role: input.examinerRole?.trim() || "Senior Certified IELTS Examiner",
      examiner_avatar: input.examinerAvatar?.trim() || avatarFor(input.examinerName),
      examiner_voice: input.examinerVoice,
      status: input.status,
      skill: "speaking",
      paper: withAccessCode({}, input.accessCode),
      part1_topics: [
        {
          id: "p1",
          title: "Part 1",
          questions: input.part1Questions,
        },
      ],
      part2_topic: {
        id: "p2",
        title: input.part2Prompt,
        content: input.part2Content?.trim() || "You should say:",
        bulletPoints: input.part2Bullets,
      },
      part3_questions: input.part3Questions.map((question, index) => ({
        id: `p3_q${index + 1}`,
        question,
      })),
    };
  }

  const shell = {
    title: input.title,
    season: input.season?.trim() || "IELTS Academic",
    examiner_name: "IELTS on Computer",
    examiner_role: "Computer-delivered",
    examiner_avatar: "/logo.png",
    examiner_voice: "en-GB-RyanNeural",
    status: input.status,
    part1_topics: [],
    part2_topic: {},
    part3_questions: [],
  };

  if (input.skill === "listening") {
    return {
      ...shell,
      skill: "listening",
      paper: withAccessCode(
        {
          sections: input.sections,
          ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
        },
        input.accessCode,
      ),
    };
  }

  if (input.skill === "reading") {
    return {
      ...shell,
      skill: "reading",
      paper: withAccessCode(
        {
          passages: input.passages,
        },
        input.accessCode,
      ),
    };
  }

  const imageUrl = input.task1ImageUrl?.trim();
  return {
    ...shell,
    skill: "writing",
    paper: withAccessCode(
      {
        task1: {
          prompt: input.task1Prompt,
          ...(imageUrl ? { imageUrl } : {}),
        },
        task2: { prompt: input.task2Prompt },
      },
      input.accessCode,
    ),
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

export function fromDbRow(row: Record<string, unknown>): PaperInput {
  const skill = parseSkill(row.skill);
  const status = row.status === "draft" ? "draft" : "published";
  const id = text(row.id);
  const title = text(row.title) || "Đề thi";
  const season = text(row.season);
  const shared = {
    ...(id ? { id } : {}),
    title,
    season,
    status,
  } as const;

  if (skill === "listening") {
    const paper = asRecord(row.paper);
    return paperInputSchema.parse(
      preparePaperInput({
        ...shared,
        skill: "listening",
        accessCode: text(paper?.accessCode) || text(paper?.access_code) || undefined,
        durationSeconds: typeof paper?.durationSeconds === "number" ? paper.durationSeconds : undefined,
        sections: Array.isArray(paper?.sections) ? paper.sections : [],
      }),
    );
  }

  if (skill === "reading") {
    const paper = asRecord(row.paper);
    const passages = Array.isArray(paper?.passages) ? paper.passages : [];
    return paperInputSchema.parse(
      preparePaperInput({
        ...shared,
        skill: "reading",
        accessCode: text(paper?.accessCode) || text(paper?.access_code) || undefined,
        passages: passages.length > 0 ? passages : [{ id: "passage-1", title: "Passage 1", text: "", questions: [] }],
      }),
    );
  }

  if (skill === "writing") {
    const paper = asRecord(row.paper);
    const task1 = asRecord(paper?.task1);
    const task2 = asRecord(paper?.task2);
    return paperInputSchema.parse(
      preparePaperInput({
        ...shared,
        skill: "writing",
        accessCode: text(paper?.accessCode) || text(paper?.access_code) || undefined,
        task1Prompt: text(task1?.prompt),
        task1ImageUrl: text(task1?.imageUrl),
        task2Prompt: text(task2?.prompt),
      }),
    );
  }

  const topics = Array.isArray(row.part1_topics) ? row.part1_topics : [];
  const part1Questions = topics.flatMap((topic) => {
    const item = asRecord(topic);
    return stringList(item?.questions);
  });
  const part2 = asRecord(row.part2_topic);
  const part3 = Array.isArray(row.part3_questions) ? row.part3_questions : [];
  const storedVoice = text(row.examiner_voice);
  return paperInputSchema.parse(
    preparePaperInput({
      ...shared,
      skill: "speaking",
      accessCode: text(asRecord(row.paper)?.accessCode) || undefined,
      examinerName: text(row.examiner_name) || "Examiner",
      examinerVoice: isExaminerVoice(storedVoice) ? storedVoice : "en-GB-RyanNeural",
      examinerRole: text(row.examiner_role) || undefined,
      examinerAvatar: text(row.examiner_avatar) || undefined,
      part2Content: text(part2?.content) || undefined,
      part1Questions,
      part2Prompt: text(part2?.title),
      part2Bullets: stringList(part2?.bulletPoints),
      part3Questions: part3
        .map((question) => text(asRecord(question)?.question))
        .filter(Boolean),
    }),
  );
}
