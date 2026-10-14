"use client";

import { useState } from "react";
import { WRITING_SECONDS, WRITING_WORD_TARGETS, type WritingPaper } from "@/lib/exam-skill";
import { countWords, formatClock } from "@/lib/ielts-score";
import { ExamShell, RoomStatus } from "@/app/exam/components/exam-shell";
import { useCandidateExam } from "@/app/exam/components/use-candidate-exam";
import { useCountdown } from "@/app/exam/components/use-countdown";

const SUBMISSION_KEY = "ielts_writing_submission";

function asWriting(paper: unknown): WritingPaper | null {
  if (!paper || typeof paper !== "object") return null;
  const row = paper as WritingPaper;
  if (!row.task1?.prompt || !row.task2?.prompt) return null;
  return row;
}

export default function WritingRoomPage() {
  const gate = useCandidateExam("writing");
  if (gate.status === "checking") return <RoomStatus title="Writing" body="Đang kiểm tra phiên thi…" />;
  if (gate.status === "config") return <RoomStatus title="Chưa cấu hình" body={gate.message} />;
  if (gate.status === "error") return <RoomStatus title="Không mở được đề" body={gate.message} />;
  const paper = asWriting(gate.exam.paper);
  if (!paper) return <RoomStatus title="Writing" body="Đề này không có Task 1 và Task 2." />;
  return <WritingExam exam={gate.exam} paper={paper} />;
}

function WritingExam({
  exam,
  paper,
}: {
  exam: { id: string; title: string; candidateName: string; candidateNumber: string };
  paper: WritingPaper;
}) {
  const [task1, setTask1] = useState("");
  const [task2, setTask2] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const words1 = countWords(task1);
  const words2 = countWords(task2);

  const submit = () => {
    const submission = {
      skill: "writing",
      examId: exam.id,
      examTitle: exam.title,
      candidateName: exam.candidateName,
      completedAt: new Date().toISOString(),
      task1: {
        prompt: paper.task1.prompt,
        imageUrl: paper.task1.imageUrl ?? "",
        response: task1,
        wordCount: countWords(task1),
      },
      task2: {
        prompt: paper.task2.prompt,
        response: task2,
        wordCount: countWords(task2),
      },
    };
    sessionStorage.setItem(SUBMISSION_KEY, JSON.stringify(submission));
    setSubmitted(true);
  };

  const left = useCountdown(WRITING_SECONDS, !submitted, submit);

  return (
    <ExamShell
      partLabel="Writing"
      title={exam.title}
      candidateName={exam.candidateName}
      candidateNumber={exam.candidateNumber}
      clock={formatClock(left)}
    >
      {submitted ? (
        <section data-testid="writing-result" className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Bài đã lưu</h2>
          <p className="text-sm text-slate-600">Hai bài viết và số từ đã được lưu.</p>
          <EssayPreview label="Task 1" prompt={paper.task1.prompt} response={task1} words={words1} target={WRITING_WORD_TARGETS.task1} />
          <EssayPreview label="Task 2" prompt={paper.task2.prompt} response={task2} words={words2} target={WRITING_WORD_TARGETS.task2} />
        </section>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <TaskCard
            label="Task 1"
            prompt={paper.task1.prompt}
            imageUrl={paper.task1.imageUrl}
            value={task1}
            words={words1}
            target={WRITING_WORD_TARGETS.task1}
            testId="writing-task1"
            onChange={setTask1}
          />
          <TaskCard
            label="Task 2"
            prompt={paper.task2.prompt}
            value={task2}
            words={words2}
            target={WRITING_WORD_TARGETS.task2}
            testId="writing-task2"
            onChange={setTask2}
          />
          <div className="lg:col-span-2">
            <button
              type="button"
              data-testid="submit-exam"
              onClick={submit}
              className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
            >
              Nộp bài Writing
            </button>
          </div>
        </div>
      )}
    </ExamShell>
  );
}

function TaskCard({
  label,
  prompt,
  imageUrl,
  value,
  words,
  target,
  testId,
  onChange,
}: {
  label: string;
  prompt: string;
  imageUrl?: string;
  value: string;
  words: number;
  target: number;
  testId: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">{label}</h2>
        <p data-testid={`${testId}-words`} className="text-sm font-semibold text-slate-700">
          {words} / {target} từ
        </p>
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{prompt}</p>
      {imageUrl ? (
        // Admin-supplied chart URL. next/image would need a remote allow-list for every host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Hình Task 1" className="max-h-64 w-full object-contain rounded-xl border border-slate-200" />
      ) : null}
      {words < target ? <p className="text-xs text-amber-800">Mục tiêu bài này là {target} từ.</p> : null}
      <label className="sr-only" htmlFor={testId}>
        {label}
      </label>
      <textarea
        id={testId}
        data-testid={testId}
        rows={12}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </section>
  );
}

function EssayPreview({
  label,
  prompt,
  response,
  words,
  target,
}: {
  label: string;
  prompt: string;
  response: string;
  words: number;
  target: number;
}) {
  return (
    <article className="border-t border-slate-100 pt-4">
      <h3 className="font-bold text-slate-900">
        {label} — {words} từ (mục tiêu {target})
      </h3>
      <p className="text-xs text-slate-600 mt-1">{prompt}</p>
      <p data-testid={`${label === "Task 1" ? "writing-task1" : "writing-task2"}-saved`} className="mt-3 text-sm whitespace-pre-wrap text-slate-800">
        {response || "(chưa viết)"}
      </p>
    </article>
  );
}
