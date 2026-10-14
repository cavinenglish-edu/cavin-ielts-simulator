"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveExamAction, type SaveState } from "@/app/admin/actions";
import {
  EXAMINER_VOICES,
  QUESTION_TYPE_LABEL,
  QUESTION_TYPES,
  TFNG_OPTIONS,
  type ExaminerVoice,
  type ListeningSection,
  type ObjectiveQuestion,
  type QuestionType,
  type ReadingPassage,
  type Skill,
} from "@/lib/exam-skill";
import type { PaperInput } from "@/lib/ielts-paper";

const initialSave: SaveState = { ok: false };

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2";

type Draft = {
  id?: string;
  title: string;
  season: string;
  catalog: "actual" | "forecast";
  skill: Skill;
  sections: ListeningSection[];
  passages: ReadingPassage[];
  task1Prompt: string;
  task1ImageUrl: string;
  task2Prompt: string;
  examinerName: string;
  examinerVoice: ExaminerVoice;
  examinerRole?: string;
  examinerAvatar?: string;
  part2Content?: string;
  part1Questions: string[];
  part2Prompt: string;
  part2ImageUrl: string;
  part2Bullets: string[];
  part3Questions: string[];
};

function newId(): string {
  return crypto.randomUUID();
}

function blankQuestion(): ObjectiveQuestion {
  return { id: newId(), type: "short_text", prompt: "", options: ["", ""], answer: "" };
}

function blankSection(index: number): ListeningSection {
  return { id: newId(), title: `Section ${index}`, audioUrl: "", questions: [blankQuestion()] };
}

function blankPassage(index: number): ReadingPassage {
  return { id: newId(), title: `Passage ${index}`, text: "", questions: [blankQuestion()] };
}

function emptyDraft(): Draft {
  return {
    title: "",
    season: "",
    catalog: "actual",
    skill: "listening",
    sections: [blankSection(1)],
    passages: [blankPassage(1)],
    task1Prompt: "",
    task1ImageUrl: "",
    task2Prompt: "",
    examinerName: "",
    examinerVoice: "en-GB-RyanNeural",
    part1Questions: [""],
    part2Prompt: "",
    part2ImageUrl: "",
    part2Bullets: [""],
    part3Questions: [""],
  };
}

function draftFromPaper(paper: PaperInput | null): Draft {
  const draft = emptyDraft();
  if (!paper) return draft;
  draft.id = paper.id;
  draft.title = paper.title;
  draft.season = paper.season ?? "";
  draft.skill = paper.skill === "sitting" ? "listening" : paper.skill;
  if (paper.skill === "sitting") {
    draft.catalog = "actual";
    draft.sections = paper.sections;
    draft.passages = paper.passages;
    draft.task1Prompt = paper.task1Prompt;
    draft.task1ImageUrl = paper.task1ImageUrl ?? "";
    draft.task2Prompt = paper.task2Prompt;
    draft.examinerName = paper.examinerName;
    draft.examinerVoice = paper.examinerVoice;
    draft.examinerRole = paper.examinerRole;
    draft.examinerAvatar = paper.examinerAvatar;
    draft.part2Content = paper.part2Content;
    draft.part1Questions = paper.part1Questions;
    draft.part2Prompt = paper.part2Prompt;
    draft.part2ImageUrl = paper.part2ImageUrl ?? "";
    draft.part2Bullets = paper.part2Bullets;
    draft.part3Questions = paper.part3Questions;
    return draft;
  }
  if (paper.skill === "listening") {
    draft.catalog = "actual";
    draft.sections = paper.sections;
  }
  if (paper.skill === "reading") {
    draft.catalog = "actual";
    draft.passages = paper.passages;
  }
  if (paper.skill === "writing") {
    draft.catalog = "actual";
    draft.task1Prompt = paper.task1Prompt;
    draft.task1ImageUrl = paper.task1ImageUrl ?? "";
    draft.task2Prompt = paper.task2Prompt;
  }
  if (paper.skill === "speaking") {
    draft.catalog = "forecast";
    draft.examinerName = paper.examinerName;
    draft.examinerVoice = paper.examinerVoice;
    draft.examinerRole = paper.examinerRole;
    draft.examinerAvatar = paper.examinerAvatar;
    draft.part2Content = paper.part2Content;
    draft.part1Questions = paper.part1Questions;
    draft.part2Prompt = paper.part2Prompt;
    draft.part2ImageUrl = paper.part2ImageUrl ?? "";
    draft.part2Bullets = paper.part2Bullets;
    draft.part3Questions = paper.part3Questions;
  }
  return draft;
}

function payloadFor(draft: Draft): Record<string, unknown> {
  const common = {
    id: draft.id,
    title: draft.title,
    season: draft.season,
  };
  if (draft.catalog === "actual") {
    return {
      ...common,
      skill: "sitting",
      catalog: "actual",
      sections: draft.sections,
      passages: draft.passages,
      task1Prompt: draft.task1Prompt,
      task1ImageUrl: draft.task1ImageUrl,
      task2Prompt: draft.task2Prompt,
      examinerName: draft.examinerName,
      examinerVoice: draft.examinerVoice,
      examinerRole: draft.examinerRole,
      examinerAvatar: draft.examinerAvatar,
      part2Content: draft.part2Content,
      part1Questions: draft.part1Questions,
      part2Prompt: draft.part2Prompt,
      part2ImageUrl: draft.part2ImageUrl,
      part2Bullets: draft.part2Bullets,
      part3Questions: draft.part3Questions,
    };
  }
  return {
    ...common,
    skill: "speaking",
    catalog: "forecast",
    examinerName: draft.examinerName,
    examinerVoice: draft.examinerVoice,
    examinerRole: draft.examinerRole,
    examinerAvatar: draft.examinerAvatar,
    part2Content: draft.part2Content,
    part1Questions: draft.part1Questions,
    part2Prompt: draft.part2Prompt,
    part2ImageUrl: draft.part2ImageUrl,
    part2Bullets: draft.part2Bullets,
    part3Questions: draft.part3Questions,
  };
}

export function PaperForm({ initial }: { initial: PaperInput | null }) {
  const [draft, setDraft] = useState<Draft>(() => draftFromPaper(initial));
  const [state, formAction, pending] = useActionState(saveExamAction, initialSave);
  const savedId = draft.id ?? state.examId;
  const skillLocked = Boolean(savedId);

  return (
    <form action={formAction} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
      <input type="hidden" name="paper" value={JSON.stringify(payloadFor({ ...draft, id: savedId }))} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{draft.id ? "Sửa đề thi" : "Tạo đề thi"}</h1>
          <p className="text-sm text-slate-600 mt-1">Chọn Đề thật hoặc Forecast, nhập nội dung, rồi xuất bản. Không có mã truy cập đề.</p>
        </div>
        {draft.id ? (
          <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
            Tạo đề mới
          </Link>
        ) : null}
      </div>

      <div role="radiogroup" aria-label="Loại đề" className="grid grid-cols-2 gap-2">
        {([
          ["actual", "Đề thật"],
          ["forecast", "Forecast"],
        ] as const).map(([catalog, label]) => {
          const active = draft.catalog === catalog;
          return (
            <button
              key={catalog}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`catalog-${catalog}`}
              disabled={skillLocked && !active}
              onClick={() => setDraft((current) => ({ ...current, catalog }))}
              className={`px-3 py-3 rounded-xl text-sm font-semibold border ${
                active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-800 border-slate-300 hover:border-slate-400"
              } disabled:opacity-50`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-600">
        {draft.catalog === "actual"
          ? "Đề thật gồm Nghe, Đọc, Viết và Nói trong cùng một đề. Máy thi chạy Nghe, rồi Đọc, rồi Viết, rồi phòng Nói của chính đề đó."
          : "Forecast chỉ là chủ đề Nói do Admin nhập tại đây. Không có nguồn cào bên ngoài."}
      </p>

      <div>
        <label htmlFor="paper-title" className={labelClass}>
          Tiêu đề
        </label>
        <input
          id="paper-title"
          data-testid="paper-title"
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          className={inputClass}
          placeholder="Ví dụ: Mini Test 1 — Listening"
        />
      </div>

      {draft.catalog === "actual" ? (
        <ListeningFields
          sections={draft.sections}
          onChange={(sections) => setDraft((current) => ({ ...current, sections }))}
        />
      ) : null}
      {draft.catalog === "actual" ? (
        <ReadingFields
          passages={draft.passages}
          onChange={(passages) => setDraft((current) => ({ ...current, passages }))}
        />
      ) : null}
      {draft.catalog === "actual" ? (
        <WritingFields
          task1Prompt={draft.task1Prompt}
          task1ImageUrl={draft.task1ImageUrl}
          task2Prompt={draft.task2Prompt}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        />
      ) : null}
      <SpeakingFields
        draft={draft}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      />

      {state.fieldErrors ? (
        <div role="alert" data-testid="field-errors" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Đề chưa hợp lệ.</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {Object.entries(state.fieldErrors).map(([path, messages]) => (
              <li key={path}>{messages.join(" ")}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.configError ? (
        <p role="alert" data-testid="config-error" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {state.configError}
        </p>
      ) : null}
      {state.message && !state.ok ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.message}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p role="status" data-testid="save-success" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          name="status"
          value="published"
          data-testid="publish-exam"
          disabled={pending}
          className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Đang lưu…" : "Xuất bản"}
        </button>
        <button
          type="submit"
          name="status"
          value="draft"
          data-testid="save-draft"
          disabled={pending}
          className="px-5 py-3 rounded-xl border border-slate-300 text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
        >
          Lưu nháp
        </button>
      </div>
    </form>
  );
}

function ListeningFields({
  sections,
  onChange,
}: {
  sections: ListeningSection[];
  onChange: (sections: ListeningSection[]) => void;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-bold text-slate-900">Listening — section và audio</legend>
      <p className="text-xs text-slate-600">Dán URL audio. Hệ thống chưa có kho lưu file.</p>
      {sections.map((section, index) => (
        <div key={section.id} className="rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Section {index + 1}</h3>
            {sections.length > 1 ? (
              <button
                type="button"
                className="text-xs font-semibold text-slate-600 hover:text-red-700"
                onClick={() => onChange(sections.filter((item) => item.id !== section.id))}
              >
                Xóa section
              </button>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor={`section-title-${section.id}`}>
              Tên section
            </label>
            <input
              id={`section-title-${section.id}`}
              className={inputClass}
              value={section.title}
              onChange={(event) =>
                onChange(sections.map((item) => (item.id === section.id ? { ...item, title: event.target.value } : item)))
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`section-audio-${section.id}`}>
              URL audio
            </label>
            <input
              id={`section-audio-${section.id}`}
              data-testid={index === 0 ? "audio-url" : undefined}
              type="url"
              className={inputClass}
              placeholder="https://..."
              value={section.audioUrl}
              onChange={(event) =>
                onChange(sections.map((item) => (item.id === section.id ? { ...item, audioUrl: event.target.value } : item)))
              }
            />
          </div>
          <QuestionEditor
            questions={section.questions}
            onChange={(questions) =>
              onChange(sections.map((item) => (item.id === section.id ? { ...item, questions } : item)))
            }
          />
        </div>
      ))}
      {sections.length < 4 ? (
        <button
          type="button"
          className="text-sm font-semibold text-blue-700"
          onClick={() => onChange([...sections, blankSection(sections.length + 1)])}
        >
          Thêm section
        </button>
      ) : null}
    </fieldset>
  );
}

function ReadingFields({
  passages,
  onChange,
}: {
  passages: ReadingPassage[];
  onChange: (passages: ReadingPassage[]) => void;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-bold text-slate-900">Reading Academic — đoạn văn</legend>
      {passages.map((passage, index) => (
        <div key={passage.id} className="rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Passage {index + 1}</h3>
            {passages.length > 1 ? (
              <button
                type="button"
                className="text-xs font-semibold text-slate-600 hover:text-red-700"
                onClick={() => onChange(passages.filter((item) => item.id !== passage.id))}
              >
                Xóa đoạn
              </button>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor={`passage-title-${passage.id}`}>
              Tiêu đề đoạn
            </label>
            <input
              id={`passage-title-${passage.id}`}
              className={inputClass}
              value={passage.title}
              onChange={(event) =>
                onChange(passages.map((item) => (item.id === passage.id ? { ...item, title: event.target.value } : item)))
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`passage-text-${passage.id}`}>
              Nội dung đoạn văn
            </label>
            <textarea
              id={`passage-text-${passage.id}`}
              data-testid={index === 0 ? "passage-text" : undefined}
              rows={6}
              className={inputClass}
              value={passage.text}
              onChange={(event) =>
                onChange(passages.map((item) => (item.id === passage.id ? { ...item, text: event.target.value } : item)))
              }
            />
          </div>
          <QuestionEditor
            questions={passage.questions}
            onChange={(questions) =>
              onChange(passages.map((item) => (item.id === passage.id ? { ...item, questions } : item)))
            }
          />
        </div>
      ))}
      {passages.length < 3 ? (
        <button
          type="button"
          className="text-sm font-semibold text-blue-700"
          onClick={() => onChange([...passages, blankPassage(passages.length + 1)])}
        >
          Thêm đoạn văn
        </button>
      ) : null}
    </fieldset>
  );
}

function WritingFields({
  task1Prompt,
  task1ImageUrl,
  task2Prompt,
  onChange,
}: {
  task1Prompt: string;
  task1ImageUrl: string;
  task2Prompt: string;
  onChange: (patch: Pick<Draft, "task1Prompt" | "task1ImageUrl" | "task2Prompt">) => void;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-bold text-slate-900">Writing Academic</legend>
      <div>
        <label className={labelClass} htmlFor="task1-prompt">
          Task 1 — đề bài
        </label>
        <textarea
          id="task1-prompt"
          data-testid="task1-prompt"
          rows={4}
          className={inputClass}
          value={task1Prompt}
          onChange={(event) => onChange({ task1Prompt: event.target.value, task1ImageUrl, task2Prompt })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="task1-image">
          Task 1 — URL hình (không bắt buộc)
        </label>
        <input
          id="task1-image"
          type="url"
          className={inputClass}
          placeholder="https://..."
          value={task1ImageUrl}
          onChange={(event) => onChange({ task1Prompt, task1ImageUrl: event.target.value, task2Prompt })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="task2-prompt">
          Task 2 — đề bài
        </label>
        <textarea
          id="task2-prompt"
          data-testid="task2-prompt"
          rows={4}
          className={inputClass}
          value={task2Prompt}
          onChange={(event) => onChange({ task1Prompt, task1ImageUrl, task2Prompt: event.target.value })}
        />
      </div>
    </fieldset>
  );
}

function SpeakingFields({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-bold text-slate-900">Speaking — Part 1, cue card, Part 3</legend>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="examiner-name">
            Tên giám khảo
          </label>
          <input
            id="examiner-name"
            data-testid="examiner-name"
            className={inputClass}
            value={draft.examinerName}
            onChange={(event) => onChange({ examinerName: event.target.value })}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="examiner-voice">
            Giọng / accent
          </label>
          <select
            id="examiner-voice"
            data-testid="examiner-voice"
            className={inputClass}
            value={draft.examinerVoice}
            onChange={(event) => onChange({ examinerVoice: event.target.value as ExaminerVoice })}
          >
            {EXAMINER_VOICES.map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <StringList
        label="Part 1 — câu hỏi"
        items={draft.part1Questions}
        onChange={(part1Questions) => onChange({ part1Questions })}
        addLabel="Thêm câu Part 1"
        testId="part1-question"
      />
      <div>
        <label className={labelClass} htmlFor="part2-prompt">
          Part 2 — cue card
        </label>
        <textarea
          id="part2-prompt"
          data-testid="part2-prompt"
          rows={3}
          className={inputClass}
          value={draft.part2Prompt}
          onChange={(event) => onChange({ part2Prompt: event.target.value })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="part2-image">
          Part 2 — ảnh cue card (nếu có)
        </label>
        <input
          id="part2-image"
          data-testid="part2-image"
          className={inputClass}
          value={draft.part2ImageUrl}
          placeholder="https://"
          onChange={(event) => onChange({ part2ImageUrl: event.target.value })}
        />
      </div>
      <StringList
        label="Part 2 — ý bullet"
        items={draft.part2Bullets}
        onChange={(part2Bullets) => onChange({ part2Bullets })}
        addLabel="Thêm ý"
        testId="part2-bullet"
      />
      <StringList
        label="Part 3 — câu hỏi"
        items={draft.part3Questions}
        onChange={(part3Questions) => onChange({ part3Questions })}
        addLabel="Thêm câu Part 3"
        testId="part3-question"
      />
    </fieldset>
  );
}

function StringList({
  label,
  items,
  onChange,
  addLabel,
  testId,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  testId: string;
}) {
  return (
    <div className="space-y-2">
      <span className={labelClass}>{label}</span>
      {items.map((item, index) => (
        <div key={`${testId}-${index}`} className="flex gap-2">
          <input
            aria-label={`${label} ${index + 1}`}
            data-testid={index === 0 ? testId : undefined}
            className={inputClass}
            value={item}
            onChange={(event) => onChange(items.map((value, itemIndex) => (itemIndex === index ? event.target.value : value)))}
          />
          {items.length > 1 ? (
            <button
              type="button"
              className="px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              Xóa
            </button>
          ) : null}
        </div>
      ))}
      <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => onChange([...items, ""])}>
        {addLabel}
      </button>
    </div>
  );
}

function QuestionEditor({
  questions,
  onChange,
}: {
  questions: ObjectiveQuestion[];
  onChange: (questions: ObjectiveQuestion[]) => void;
}) {
  const update = (id: string, patch: Partial<ObjectiveQuestion>) => {
    onChange(questions.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  };

  return (
    <div className="space-y-3">
      <span className={labelClass}>Câu hỏi và đáp án</span>
      {questions.map((question, index) => {
        const choice = question.type === "multiple_choice" || question.type === "matching";
        return (
          <div key={question.id} className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-600">Câu {index + 1}</span>
              {questions.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-600 hover:text-red-700"
                  onClick={() => onChange(questions.filter((item) => item.id !== question.id))}
                >
                  Xóa câu
                </button>
              ) : null}
            </div>
            <label className={labelClass} htmlFor={`q-type-${question.id}`}>
              Dạng câu
            </label>
            <select
              id={`q-type-${question.id}`}
              className={inputClass}
              value={question.type}
              onChange={(event) => {
                const type = event.target.value as QuestionType;
                update(question.id, {
                  type,
                  answer: type === "true_false_not_given" ? "True" : question.answer,
                });
              }}
            >
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUESTION_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
            <label className={labelClass} htmlFor={`q-prompt-${question.id}`}>
              Nội dung
            </label>
            <textarea
              id={`q-prompt-${question.id}`}
              data-testid={index === 0 ? "question-prompt" : undefined}
              rows={2}
              className={inputClass}
              value={question.prompt}
              onChange={(event) => update(question.id, { prompt: event.target.value })}
            />
            {choice ? (
              <div>
                <label className={labelClass} htmlFor={`q-options-${question.id}`}>
                  Phương án — mỗi dòng một ý
                </label>
                <textarea
                  id={`q-options-${question.id}`}
                  rows={3}
                  className={inputClass}
                  value={(question.options ?? []).join("\n")}
                  onChange={(event) => update(question.id, { options: event.target.value.split("\n") })}
                />
              </div>
            ) : null}
            {question.type === "true_false_not_given" ? (
              <div>
                <label className={labelClass} htmlFor={`q-tfng-${question.id}`}>
                  Đáp án
                </label>
                <select
                  id={`q-tfng-${question.id}`}
                  className={inputClass}
                  value={question.answer || "True"}
                  onChange={(event) => update(question.id, { answer: event.target.value })}
                >
                  {TFNG_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className={labelClass} htmlFor={`q-answer-${question.id}`}>
                  Đáp án
                </label>
                <input
                  id={`q-answer-${question.id}`}
                  data-testid={index === 0 ? "question-answer" : undefined}
                  className={inputClass}
                  value={question.answer}
                  onChange={(event) => update(question.id, { answer: event.target.value })}
                />
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => onChange([...questions, blankQuestion()])}>
        Thêm câu hỏi
      </button>
    </div>
  );
}
