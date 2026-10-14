"use client";

import { useMemo, useState } from "react";
import { READING_SECONDS, type ReadingPaper } from "@/lib/exam-skill";
import { formatClock, scoreObjective } from "@/lib/ielts-score";
import { ExamShell, RoomStatus } from "@/app/exam/components/exam-shell";
import { ObjectiveQuestions, ScoreResult } from "@/app/exam/components/objective-questions";
import { useCandidateExam } from "@/app/exam/components/use-candidate-exam";
import { useCountdown } from "@/app/exam/components/use-countdown";

function asReading(paper: unknown): ReadingPaper | null {
  if (!paper || typeof paper !== "object" || !("passages" in paper)) return null;
  const passages = (paper as ReadingPaper).passages;
  if (!Array.isArray(passages) || passages.length === 0) return null;
  return paper as ReadingPaper;
}

export default function ReadingRoomPage() {
  const gate = useCandidateExam("reading");
  if (gate.status === "checking") return <RoomStatus title="Reading" body="Đang kiểm tra phiên thi…" />;
  if (gate.status === "config") return <RoomStatus title="Chưa cấu hình" body={gate.message} />;
  if (gate.status === "error") return <RoomStatus title="Không mở được đề" body={gate.message} />;
  const paper = asReading(gate.exam.paper);
  if (!paper) return <RoomStatus title="Reading" body="Đề này không có đoạn Reading." />;
  return <ReadingExam exam={gate.exam} paper={paper} />;
}

function ReadingExam({
  exam,
  paper,
}: {
  exam: { title: string; candidateName: string; candidateNumber: string };
  paper: ReadingPaper;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const questions = useMemo(
    () => paper.passages.flatMap((passage) => passage.questions),
    [paper.passages],
  );
  const submit = () => setSubmitted(true);
  const left = useCountdown(READING_SECONDS, !submitted, submit);
  const result = submitted ? scoreObjective(questions, answers) : null;

  return (
    <ExamShell
      partLabel="Reading"
      title={exam.title}
      candidateName={exam.candidateName}
      candidateNumber={exam.candidateNumber}
      clock={formatClock(left)}
    >
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {paper.passages.map((passage) => (
            <article key={passage.id}>
              <h2 className="text-base font-bold text-slate-900">{passage.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-800 whitespace-pre-wrap">{passage.text}</p>
            </article>
          ))}
        </div>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <ObjectiveQuestions
            questions={questions}
            answers={answers}
            disabled={submitted}
            onChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
          />
          {!submitted ? (
            <button
              type="button"
              data-testid="submit-exam"
              onClick={submit}
              className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
            >
              Nộp bài Reading
            </button>
          ) : null}
          {result ? <ScoreResult correct={result.correct} total={result.total} items={result.items} /> : null}
        </div>
      </div>
    </ExamShell>
  );
}
