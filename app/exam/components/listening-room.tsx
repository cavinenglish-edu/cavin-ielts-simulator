"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { formatClock } from "@/lib/ielts-score";
import type { PublicSession } from "@/lib/exam-sitting";
import type { ClientListening } from "@/lib/exam-paper-view";
import { ExamShell } from "@/app/exam/components/exam-shell";
import { ObjectiveQuestions } from "@/app/exam/components/objective-questions";
import { QuestionNav } from "@/app/exam/components/question-nav";
import { useSittingRecovery } from "@/app/exam/components/use-sitting-recovery";
import { pathForSession, useExamCountdown, useSessionRefresh } from "@/app/exam/components/use-exam-countdown";

export function ListeningRoom({ initial, paper }: { initial: PublicSession; paper: ClientListening }) {
  const router = useRouter();
  const [session, setSession] = useState(initial);
  const apply = useCallback((next: PublicSession) => {
    if (next.section !== "listening") {
      router.replace(pathForSession(next));
      return;
    }
    setSession(next);
  }, [router]);
  useSessionRefresh(apply);
  const { state, setState, hydrated } = useSittingRecovery(initial.paperId);
  const questions = useMemo(() => paper.sections.flatMap((section) => section.questions), [paper.sections]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sent = useRef("");
  const left = useExamCountdown(session);
  const [locked, setLocked] = useState(false);
  const section = paper.sections[sectionIndex] ?? paper.sections[0];
  const startIndex = paper.sections.slice(0, sectionIndex).reduce((sum, item) => sum + item.questions.length, 0);

  const refreshSession = useCallback(async () => {
    const response = await fetch("/api/exam/session", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { session: PublicSession };
    setSession(data.session);
  }, []);

  const startReview = useCallback(async () => {
    const response = await fetch("/api/exam/audio-ended", { method: "POST" });
    if (!response.ok) return;
    const data = (await response.json()) as { session: PublicSession };
    setSession(data.session);
  }, []);

  const advance = useCallback(async () => {
    const response = await fetch("/api/exam/advance", { method: "POST" });
    if (response.status === 409) {
      setLocked(false);
      sent.current = "";
      await refreshSession();
      return;
    }
    if (!response.ok) return;
    const data = (await response.json()) as { next: string };
    router.replace(data.next);
  }, [refreshSession, router]);

  useEffect(() => {
    const key = `${session.section}:${session.listeningPhase}:${session.startedAt}:${session.clockOffsetMs}`;
    if (left > 0 || sent.current === key) return;
    const timer = window.setTimeout(() => {
      sent.current = key;
      if (session.listeningPhase === "audio") {
        void startReview();
        return;
      }
      setLocked(true);
      window.setTimeout(() => void advance(), 300);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [advance, left, session.clockOffsetMs, session.listeningPhase, session.section, session.startedAt, startReview]);

  const changeAnswer = (id: string, value: string) => {
    setState((current) => ({ ...current, listening: { ...current.listening, [id]: value } }));
  };

  return (
    <ExamShell
      fill
      partLabel="Listening"
      title={paper.title}
      candidateName={session.name}
      candidateNumber={session.candidateNumber}
      clock={formatClock(left)}
      locked={locked}
    >
      <div className="h-full min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6">
          <p data-testid="listening-phase" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {session.listeningPhase === "review" ? "Review" : "Audio"}
          </p>
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
          {section ? (
            <OnceAudio
              src={section.audioUrl}
              audioRef={audioRef}
              playing={playing}
              disabled={locked || session.listeningPhase === "review"}
              onPlay={() => setPlaying(true)}
              onEnded={() => {
                if (sectionIndex < paper.sections.length - 1) {
                  setSectionIndex((current) => current + 1);
                  setPlaying(false);
                  return;
                }
                void startReview();
              }}
            />
          ) : null}
          {hydrated && section ? (
            <ObjectiveQuestions
              questions={section.questions}
              answers={state.listening}
              disabled={locked}
              startIndex={startIndex}
              onChange={changeAnswer}
            />
          ) : (
            <p className="text-sm text-slate-600">Đang khôi phục bài làm…</p>
          )}
        </div>
        <QuestionNav questions={questions} answers={state.listening} />
      </div>
    </ExamShell>
  );
}

function OnceAudio({
  src,
  audioRef,
  playing,
  disabled,
  onPlay,
  onEnded,
}: {
  src: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  playing: boolean;
  disabled: boolean;
  onPlay: () => void;
  onEnded: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Audio</p>
      <p className="text-xs text-slate-600 mt-1 mb-3">Phát một lần. Không có nút tạm dừng.</p>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onEnded={onEnded}
      />
      <button
        type="button"
        data-testid="play-audio"
        disabled={disabled || playing}
        onClick={() => {
          const audio = audioRef.current;
          if (!audio || disabled || playing) return;
          void audio.play().then(() => onPlay()).catch(() => undefined);
        }}
        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
      >
        {playing ? "Đang phát" : "Phát audio"}
      </button>
    </div>
  );
}
