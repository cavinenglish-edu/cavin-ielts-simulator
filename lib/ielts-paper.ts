import { z } from "zod";
import {
  EXAMINER_VOICES,
  STANDARD_QUESTION_TYPES,
  TFNG_OPTIONS,
  isExaminerVoice,
  parseSkill,
  type ExaminerVoice,
  type FormTableGap,
  type FormTableQuestion,
  type FormTableRow,
  type ListeningPaper,
  type ObjectiveQuestion,
  type ReadingPaper,
  type Skill,
  type StandardQuestionType,
  type WritingPaper,
} from "@/lib/exam-skill";
import { computerParts } from "@/lib/exam-catalog";
import { parseNoteGaps } from "@/lib/form-table";
import { normalizeAnswer } from "@/lib/ielts-score";

const voiceValues = EXAMINER_VOICES.map((voice) => voice.value) as [ExaminerVoice, ...ExaminerVoice[]];

const standardQuestionSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.enum(STANDARD_QUESTION_TYPES),
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

const formTableSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.literal("form_table"),
    title: z.string().trim().max(200),
    rows: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          label: z.string().trim().min(1, "Nhập nhãn"),
          answer: z.string().trim().min(1, "Nhập đáp án"),
        }),
      )
      .max(40),
    note: z.string().max(8000),
    gaps: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          marker: z.number().int().min(1).max(99),
          answer: z.string().trim().min(1, "Nhập đáp án chỗ trống"),
        }),
      )
      .max(40),
  })
  .superRefine((group, ctx) => {
    const markers = parseNoteGaps(group.note);
    if (group.rows.length === 0 && markers.length === 0) {
      ctx.addIssue({ code: "custom", path: ["rows"], message: "Thêm ít nhất một dòng hoặc một chỗ trống {{1}}" });
    }
    const answered = new Set(group.gaps.map((gap) => gap.marker));
    for (const marker of markers) {
      if (!answered.has(marker)) {
        ctx.addIssue({ code: "custom", path: ["gaps"], message: `Thiếu đáp án cho {{${marker}}}` });
      }
    }
  });

const questionSchema = z.union([standardQuestionSchema, formTableSchema]);

const listeningSchema = z.object({
  id: z.string().uuid("Mã đề không hợp lệ").optional(),
  skill: z.literal("listening"),
  title: z.string().trim().min(1, "Nhập tiêu đề đề thi"),
  season: z.string().trim().optional(),
  status: z.enum(["draft", "published"]),
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
  catalog: z.literal("forecast").optional(),
  examinerName: z.string().trim().min(2, "Nhập tên giám khảo"),
  examinerVoice: z.enum(voiceValues),
  examinerRole: z.string().trim().min(1).optional(),
  examinerAvatar: z.string().trim().min(1).optional(),
  part2Content: z.string().trim().min(1).optional(),
  part1Questions: z.array(z.string().trim().min(1, "Nhập câu hỏi Part 1")).min(1, "Cần ít nhất một câu Part 1").max(20),
  part2Prompt: z.string().trim().min(1, "Nhập đề cue card Part 2"),
  part2ImageUrl: z.union([z.literal(""), z.url("URL cue card không hợp lệ")]).optional(),
  part2Bullets: z.array(z.string().trim().min(1, "Nhập ý bullet Part 2")).min(1, "Cần ít nhất một ý Part 2").max(8),
  part3Questions: z.array(z.string().trim().min(1, "Nhập câu hỏi Part 3")).min(1, "Cần ít nhất một câu Part 3").max(20),
});

const sittingSchema = z.object({
  id: z.string().uuid("Mã đề không hợp lệ").optional(),
  skill: z.literal("sitting"),
  catalog: z.literal("actual"),
  title: z.string().trim().min(1, "Nhập tiêu đề đề thi"),
  season: z.string().trim().optional(),
  status: z.enum(["draft", "published"]),
  durationSeconds: z.number().int().positive().max(7200).optional(),
  sections: listeningSchema.shape.sections,
  passages: readingSchema.shape.passages,
  task1Prompt: z.string().trim().min(1, "Nhập đề Task 1").max(20000),
  task1ImageUrl: z.union([z.literal(""), z.url("URL hình Task 1 không hợp lệ")]).optional(),
  task2Prompt: z.string().trim().min(1, "Nhập đề Task 2").max(20000),
  examinerName: z.string().trim().min(2, "Nhập tên giám khảo"),
  examinerVoice: z.enum(voiceValues),
  examinerRole: z.string().trim().min(1).optional(),
  examinerAvatar: z.string().trim().min(1).optional(),
  part2Content: z.string().trim().min(1).optional(),
  part1Questions: z.array(z.string().trim().min(1, "Nhập câu hỏi Part 1")).min(1, "Cần ít nhất một câu Part 1").max(20),
  part2Prompt: z.string().trim().min(1, "Nhập đề cue card Part 2"),
  part2ImageUrl: z.union([z.literal(""), z.url("URL cue card không hợp lệ")]).optional(),
  part2Bullets: z.array(z.string().trim().min(1, "Nhập ý bullet Part 2")).min(1, "Cần ít nhất một ý Part 2").max(8),
  part3Questions: z.array(z.string().trim().min(1, "Nhập câu hỏi Part 3")).min(1, "Cần ít nhất một câu Part 3").max(20),
});

export const paperInputSchema = z.discriminatedUnion("skill", [
  listeningSchema,
  readingSchema,
  writingSchema,
  speakingSchema,
  sittingSchema,
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
  paper: ListeningPaper | ReadingPaper | WritingPaper | Record<string, unknown>;
  part1_topics: Array<{ id: string; title: string; questions: string[] }>;
  part2_topic:
    | { id: string; title: string; content: string; bulletPoints: string[]; imageUrl?: string }
    | Record<string, never>;
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

function prepareFormTable(row: Record<string, unknown>): FormTableQuestion | null {
  const rows = Array.isArray(row.rows)
    ? row.rows.flatMap((item): FormTableRow[] => {
        const record = asRecord(item);
        if (!record) return [];
        const label = text(record.label);
        const answer = text(record.answer);
        if (!label && !answer) return [];
        const id = text(record.id) || `row_${Math.random().toString(36).slice(2, 10)}`;
        return [{ id, label, answer }];
      })
    : [];
  const note = typeof row.note === "string" ? row.note.trim() : "";
  const markers = parseNoteGaps(note);
  const provided = Array.isArray(row.gaps) ? row.gaps : [];
  const gaps: FormTableGap[] = markers.map((marker) => {
    const found = provided
      .map((item) => asRecord(item))
      .find((item) => item !== null && Number(item.marker) === marker);
    return {
      id: text(found?.id) || `gap_${marker}`,
      marker,
      answer: text(found?.answer),
    };
  });
  if (rows.length === 0 && gaps.length === 0) return null;
  const id = text(row.id) || `form_${Math.random().toString(36).slice(2, 10)}`;
  return { id, type: "form_table", title: text(row.title), rows, note: gaps.length > 0 ? note : "", gaps };
}

function prepareQuestion(value: unknown): ObjectiveQuestion | null {
  const row = asRecord(value);
  if (!row) return null;
  if (row.type === "form_table") return prepareFormTable(row);
  const prompt = text(row.prompt);
  const rawAnswer = text(row.answer);
  if (!prompt && !rawAnswer) return null;
  const type = STANDARD_QUESTION_TYPES.includes(row.type as StandardQuestionType)
    ? (row.type as StandardQuestionType)
    : "short_text";
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

export function prepareQuestions(value: unknown): ObjectiveQuestion[] {
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

  if (skill === "sitting") {
    return {
      ...base,
      sections: Array.isArray(row.sections)
        ? row.sections.map((section, index) => {
            const item = asRecord(section) ?? {};
            return {
              id: text(item.id) || `section-${index + 1}`,
              title: text(item.title) || `Section ${index + 1}`,
              audioUrl: text(item.audioUrl),
              questions: prepareQuestions(item.questions),
            };
          })
        : [],
      passages: Array.isArray(row.passages)
        ? row.passages.map((passage, index) => {
            const item = asRecord(passage) ?? {};
            return {
              id: text(item.id) || `passage-${index + 1}`,
              title: text(item.title) || `Passage ${index + 1}`,
              text: text(item.text),
              questions: prepareQuestions(item.questions),
            };
          })
        : [],
      task1Prompt: text(row.task1Prompt),
      task1ImageUrl: text(row.task1ImageUrl),
      task2Prompt: text(row.task2Prompt),
      examinerName: text(row.examinerName),
      examinerVoice: text(row.examinerVoice),
      part1Questions: cleanSpeakingList(row.part1Questions),
      part2Prompt: text(row.part2Prompt),
      part2ImageUrl: text(row.part2ImageUrl),
      part2Bullets: cleanSpeakingList(row.part2Bullets),
      part3Questions: cleanSpeakingList(row.part3Questions),
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
      part2ImageUrl: text(row.part2ImageUrl),
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

function avatarFor(name: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
}

function speakingColumns(input: {
  examinerName: string;
  examinerRole?: string;
  examinerAvatar?: string;
  examinerVoice: string;
  part2Content?: string;
  part1Questions: string[];
  part2Prompt: string;
  part2ImageUrl?: string;
  part2Bullets: string[];
  part3Questions: string[];
}) {
  const cueImage = input.part2ImageUrl?.trim();
  return {
    examiner_name: input.examinerName,
    examiner_role: input.examinerRole?.trim() || "Senior Certified IELTS Examiner",
    examiner_avatar: input.examinerAvatar?.trim() || avatarFor(input.examinerName),
    examiner_voice: input.examinerVoice,
    part1_topics: [{ id: "p1", title: "Part 1", questions: input.part1Questions }],
    part2_topic: {
      id: "p2",
      title: input.part2Prompt,
      content: input.part2Content?.trim() || "You should say:",
      bulletPoints: input.part2Bullets,
      ...(cueImage ? { imageUrl: cueImage } : {}),
    },
    part3_questions: input.part3Questions.map((question, index) => ({
      id: `p3_q${index + 1}`,
      question,
    })),
  };
}

export function toDbRow(input: PaperInput): IeltsExamWrite {
  if (input.skill === "sitting") {
    const imageUrl = input.task1ImageUrl?.trim();
    return {
      title: input.title,
      season: input.season?.trim() || "IELTS Academic",
      ...speakingColumns(input),
      status: input.status,
      skill: "listening",
      paper: {
        catalog: "actual",
        sections: input.sections,
        ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
        passages: input.passages,
        task1: {
          prompt: input.task1Prompt,
          ...(imageUrl ? { imageUrl } : {}),
        },
        task2: { prompt: input.task2Prompt },
      },
    };
  }

  if (input.skill === "speaking") {
    return {
      title: input.title,
      season: input.season?.trim() || "Forecast",
      ...speakingColumns(input),
      status: input.status,
      skill: "speaking",
      paper: { catalog: "forecast" },
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
        ...(input.part2ImageUrl?.trim() ? { imageUrl: input.part2ImageUrl.trim() } : {}),
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
      paper: {
        catalog: "actual",
        sections: input.sections,
        ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
      },
    };
  }

  if (input.skill === "reading") {
    return {
      ...shell,
      skill: "reading",
      paper: {
        catalog: "actual",
        passages: input.passages,
      },
    };
  }

  const imageUrl = input.task1ImageUrl?.trim();
  return {
    ...shell,
    skill: "writing",
    paper: {
      catalog: "actual",
      task1: {
        prompt: input.task1Prompt,
        ...(imageUrl ? { imageUrl } : {}),
      },
      task2: { prompt: input.task2Prompt },
    },
  };
}

function cleanSpeakingList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
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
  const storedPaper = asRecord(row.paper);
  const parts = computerParts(storedPaper);

  if (storedPaper?.catalog !== "forecast" && parts.listening && parts.reading && parts.writing) {
    const task1 = asRecord(storedPaper?.task1);
    const task2 = asRecord(storedPaper?.task2);
    return paperInputSchema.parse(
      preparePaperInput({
        ...shared,
        skill: "sitting",
        catalog: "actual",
        durationSeconds: typeof storedPaper?.durationSeconds === "number" ? storedPaper.durationSeconds : undefined,
        sections: storedPaper?.sections,
        passages: storedPaper?.passages,
        task1Prompt: text(task1?.prompt),
        task1ImageUrl: text(task1?.imageUrl),
        task2Prompt: text(task2?.prompt),
        examinerName: text(row.examiner_name) || "Examiner",
        examinerVoice: isExaminerVoice(text(row.examiner_voice)) ? text(row.examiner_voice) : "en-GB-RyanNeural",
        examinerRole: text(row.examiner_role) || undefined,
        part1Questions: (Array.isArray(row.part1_topics) ? row.part1_topics : []).flatMap((topic) => stringList(asRecord(topic)?.questions)),
        part2Prompt: text(asRecord(row.part2_topic)?.title),
        part2ImageUrl: text(asRecord(row.part2_topic)?.imageUrl),
        part2Content: text(asRecord(row.part2_topic)?.content) || undefined,
        part2Bullets: stringList(asRecord(row.part2_topic)?.bulletPoints),
        part3Questions: (Array.isArray(row.part3_questions) ? row.part3_questions : [])
          .map((question) => text(asRecord(question)?.question))
          .filter(Boolean),
      }),
    );
  }

  if (skill === "listening") {
    return paperInputSchema.parse(
      preparePaperInput({
        ...shared,
        skill: "listening",
        durationSeconds: typeof storedPaper?.durationSeconds === "number" ? storedPaper.durationSeconds : undefined,
        sections: Array.isArray(storedPaper?.sections) ? storedPaper.sections : [],
      }),
    );
  }

  if (skill === "reading") {
    const passages = Array.isArray(storedPaper?.passages) ? storedPaper.passages : [];
    return paperInputSchema.parse(
      preparePaperInput({
        ...shared,
        skill: "reading",
        passages: passages.length > 0 ? passages : [{ id: "passage-1", title: "Passage 1", text: "", questions: [] }],
      }),
    );
  }

  if (skill === "writing") {
    const task1 = asRecord(storedPaper?.task1);
    const task2 = asRecord(storedPaper?.task2);
    return paperInputSchema.parse(
      preparePaperInput({
        ...shared,
        skill: "writing",
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
      catalog: "forecast",
      examinerName: text(row.examiner_name) || "Examiner",
      examinerVoice: isExaminerVoice(storedVoice) ? storedVoice : "en-GB-RyanNeural",
      examinerRole: text(row.examiner_role) || undefined,
      examinerAvatar: text(row.examiner_avatar) || undefined,
      part2Content: text(part2?.content) || undefined,
      part1Questions,
      part2Prompt: text(part2?.title),
      part2ImageUrl: text(part2?.imageUrl),
      part2Bullets: stringList(part2?.bulletPoints),
      part3Questions: part3
        .map((question) => text(asRecord(question)?.question))
        .filter(Boolean),
    }),
  );
}
