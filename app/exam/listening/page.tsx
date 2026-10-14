"use client";

import { useMemo, useRef, useState } from "react";
import { LISTENING_SECONDS, type ListeningPaper } from "@/lib/exam-skill";
import { formatClock, scoreObjective } from "@/lib/ielts-score";
import { ExamShell, RoomStatus } from "@/app/exam/components/exam-shell";
import { ObjectiveQuestions, ScoreResult } from "@/app/exam/components/objective-questions";
import { useCandidateExam } from "@/app/exam/components/use-candidate-exam";
import { useCountdown } from "@/app/exam/components/use-countdown";

function asListening(paper: unknown): ListeningPaper | null {
  if (!paper || typeof paper !== "object" || !("sections" in paper)) return null;
  const sections = (paper as ListeningPaper).sections;
  if (!Array.isArray(sections) || sections.length === 0) return null;
  return paper as ListeningPaper;
}

export default function ListeningRoomPage() {
  const gate = useCandidateExam("listening");
  if (gate.status === "checking") {
    return <RoomStatus title="Listening" body="Đang kiểm tra phiên thi…" />;
  }
  if (gate.status === "config") return <RoomStatus title="Chưa cấu hình" body={gate.message} />;
  if (gate.status === "error") return <RoomStatus title="Không mở được đề" body={gate.message} />;
  const paper = asListening(gate.exam.paper);
  if (!paper) return <RoomStatus title="Listening" body="Đề này không có section Listening." />;
  return <ListeningExam exam={gate.exam} paper={paper} />;
}

function ListeningExam({
  exam,
  paper,
}: {
  exam: { title: string; candidateName: string; candidateNumber: string };
  paper: ListeningPaper;
}) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const questions = useMemo(() => paper.sections.flatMap((section) => section.questions), [paper.sections]);
  const submit = () => setSubmitted(true);
  const left = useCountdown(LISTENING_SECONDS, !submitted, submit);
  const section = paper.sections[sectionIndex] ?? paper.sections[0];
  const result = submitted ? scoreObjective(questions, answers) : null;

  return (
    <ExamShell
      partLabel="Listening"
      title={exam.title}
      candidateName={exam.candidateName}
      candidateNumber={exam.candidateNumber}
      clock={formatClock(left)}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections">
          {paper.sections.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === sectionIndex}
              onClick={() => setSectionIndex(index)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                index === sectionIndex ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-800 border-slate-300"
              }`}
            >
              {item.title || `Section ${index + 1}`}
            </button>
          ))}
        </div>
        {section ? <OnceAudio src={section.audioUrl} /> : null}
        {section ? (
          <ObjectiveQuestions
            questions={section.questions}
            answers={answers}
            disabled={submitted}
            onChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
          />
        ) : null}
        {result ? <ScoreResult correct={result.correct} total={result.total} items={result.items} /> : null}
        {!submitted ? (
          <button
            type="button"
            data-testid="submit-exam"
            onClick={submit}
            className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
          >
            Nộp bài Listening
          </button>
        ) : null}
        <p className="sr-only">{questions.length} câu</p>
      </div>
    </ExamShell>
  );
}

function OnceAudio({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Audio</p>
      <p className="text-xs text-slate-600 mt-1 mb-3">Phát một lần, không phát lại.</p>
      <audio ref={audioRef} src={src} preload="none" onEnded={() => setPhase("done")} />
      {phase === "done" ? (
        <p className="text-sm text-slate-700">Audio đã phát xong.</p>
      ) : (
        <button
          type="button"
          data-testid="play-audio"
          disabled={phase === "playing"}
          onClick={() => {
            const audio = audioRef.current;
            if (!audio || phase === "playing") return;
            setPhase("playing");
            audio.play().catch(() => setPhase("idle"));
          }}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
        >
          {phase === "playing" ? "Đang phát" : "Phát audio"}
        </button>
      )}
    </div>
  );
}
