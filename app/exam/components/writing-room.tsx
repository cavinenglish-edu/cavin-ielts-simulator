"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { countWords, formatClock } from "@/lib/ielts-score";
import { WRITING_WORD_TARGETS } from "@/lib/exam-skill";
import type { PublicSession } from "@/lib/exam-sitting";
import type { SubmitView } from "@/lib/exam-submit";
import type { ClientWriting } from "@/lib/exam-paper-view";
import { ExamShell } from "@/app/exam/components/exam-shell";
import { postSubmit } from "@/app/exam/components/post-submit";
import { SubmissionNotice } from "@/app/exam/components/submission-notice";
import { useSittingRecovery } from "@/app/exam/components/use-sitting-recovery";
import { pathForSession, useExamCountdown, useSessionRefresh } from "@/app/exam/components/use-exam-countdown";

export function WritingRoom({ initial, paper }: { initial: PublicSession; paper: ClientWriting }) {
  const router = useRouter();
  const [session, setSession] = useState(initial);
  const apply = useCallback((next: PublicSession) => {
    if (next.section !== "writing") {
      router.replace(pathForSession(next));
      return;
    }
    setSession(next);
  }, [router]);
  useSessionRefresh(apply);
  const { state, setState, hydrated } = useSittingRecovery(initial.paperId);
  const left = useExamCountdown(session);
  const [locked, setLocked] = useState(false);
  const [submitView, setSubmitView] = useState<SubmitView | null>(null);
  const sent = useRef("");
  const draftsRef = useRef({ task1: state.task1, task2: state.task2 });
  useEffect(() => {
    draftsRef.current = { task1: state.task1, task2: state.task2 };
  });
  const task = state.writingTask;
  const draft = task === 1 ? state.task1 : state.task2;
  const prompt = task === 1 ? paper.task1.prompt : paper.task2.prompt;
  const target = task === 1 ? WRITING_WORD_TARGETS.task1 : WRITING_WORD_TARGETS.task2;

  const advance = useCallback(async () => {
    const response = await fetch("/api/exam/advance", { method: "POST" });
    if (response.status === 409) {
      setLocked(false);
      sent.current = "";
      return;
    }
    if (!response.ok) return;
    const data = (await response.json()) as { next: string };
    router.replace(data.next);
  }, [router]);

  useEffect(() => {
    const key = `${session.startedAt}:${session.clockOffsetMs}`;
    if (left > 0 || sent.current === key) return;
    const timer = window.setTimeout(() => {
      sent.current = key;
      setLocked(true);
      void postSubmit({ skill: "writing", task1: draftsRef.current.task1, task2: draftsRef.current.task2 }).then((view) => {
        setSubmitView(view);
        window.setTimeout(() => void advance(), 2500);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [advance, left, session.clockOffsetMs, session.startedAt]);

  return (
    <ExamShell
      fill
      partLabel="Writing"
      title={paper.title}
      candidateName={session.name}
      candidateNumber={session.candidateNumber}
      clock={formatClock(left)}
      locked={locked}
    >
      <div className="h-full min-h-0 flex flex-col">
        <SubmissionNotice view={submitView} />
        <div className="shrink-0 flex gap-2 px-6 pt-4">
          <button
            type="button"
            data-testid="writing-task-1"
            aria-pressed={task === 1}
            onClick={() => setState((current) => ({ ...current, writingTask: 1 }))}
            className={`px-4 py-2 rounded-xl text-sm font-bold border ${task === 1 ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-800 border-slate-300"}`}
          >
            Task 1
          </button>
          <button
            type="button"
            data-testid="writing-task-2"
            aria-pressed={task === 2}
            onClick={() => setState((current) => ({ ...current, writingTask: 2 }))}
            className={`px-4 py-2 rounded-xl text-sm font-bold border ${task === 2 ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-800 border-slate-300"}`}
          >
            Task 2
          </button>
        </div>
        <div className="grid flex-1 min-h-0 grid-cols-2">
          <article data-testid="writing-prompt" className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white px-6 py-6">
            <h2 className="text-base font-bold text-slate-900">Task {task}</h2>
            <p className="mt-3 text-sm leading-7 whitespace-pre-wrap text-slate-800">{prompt}</p>
            {task === 1 && paper.task1.imageUrl ? (
              // Admin-supplied chart URL. next/image would need a remote allow-list for every host.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={paper.task1.imageUrl} alt="Hình Task 1" className="mt-4 max-h-64 w-full object-contain rounded-xl border border-slate-200" />
            ) : null}
          </article>
          <div className="min-h-0 flex flex-col px-6 py-6">
            <label className="sr-only" htmlFor="writing-response">
              Bài viết Task {task}
            </label>
            <textarea
              id="writing-response"
              data-testid="writing-response"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              disabled={!hydrated || locked}
              value={hydrated ? draft : ""}
              onChange={(event) => {
                const value = event.target.value;
                setState((current) => (task === 1 ? { ...current, task1: value } : { ...current, task2: value }));
              }}
              className="min-h-0 flex-1 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p data-testid="writing-word-count" className="mt-2 text-sm font-semibold text-slate-700">
              {countWords(hydrated ? draft : "")} từ
              <span className="ml-2 font-normal text-slate-500">mục tiêu {target}</span>
            </p>
          </div>
        </div>
      </div>
    </ExamShell>
  );
}
