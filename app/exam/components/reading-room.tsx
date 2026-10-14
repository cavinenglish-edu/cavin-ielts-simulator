"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatClock } from "@/lib/ielts-score";
import type { PublicSession } from "@/lib/exam-sitting";
import type { ClientReading } from "@/lib/exam-paper-view";
import type { PassageMark } from "@/lib/sitting-recovery";
import { ExamShell } from "@/app/exam/components/exam-shell";
import { ObjectiveQuestions } from "@/app/exam/components/objective-questions";
import { useSittingRecovery } from "@/app/exam/components/use-sitting-recovery";
import { pathForSession, useExamCountdown, useSessionRefresh } from "@/app/exam/components/use-exam-countdown";

type Popup = { x: number; y: number; passageId: string; start: number; end: number };

export function ReadingRoom({ initial, paper }: { initial: PublicSession; paper: ClientReading }) {
  const router = useRouter();
  const [session, setSession] = useState(initial);
  const apply = useCallback((next: PublicSession) => {
    if (next.section !== "reading") {
      router.replace(pathForSession(next));
      return;
    }
    setSession(next);
  }, [router]);
  useSessionRefresh(apply);
  const { state, setState, hydrated } = useSittingRecovery(initial.paperId);
  const left = useExamCountdown(session);
  const [locked, setLocked] = useState(false);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const sent = useRef("");
  const alert = left <= 5 * 60 ? "5" : left <= 10 * 60 ? "10" : "none";
  const questions = paper.passages.flatMap((passage) => passage.questions);

  const advance = useCallback(async () => {
    const response = await fetch("/api/exam/advance", { method: "POST" });
    if (response.status === 409) {
      setLocked(false);
      sent.current = "";
      const fresh = await fetch("/api/exam/session", { cache: "no-store" });
      if (fresh.ok) {
        const data = (await fresh.json()) as { session: PublicSession };
        setSession(data.session);
      }
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
      window.setTimeout(() => void advance(), 300);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [advance, left, session.clockOffsetMs, session.startedAt]);

  const addMark = (note: string) => {
    if (!popup) return;
    const mark: PassageMark = {
      id: crypto.randomUUID(),
      passageId: popup.passageId,
      start: popup.start,
      end: popup.end,
      note,
    };
    setState((current) => ({
      ...current,
      marks: [...current.marks.filter((item) => item.passageId !== mark.passageId || item.end <= mark.start || item.start >= mark.end), mark],
    }));
    setPopup(null);
    setNoteOpen(false);
    setNoteDraft("");
    window.getSelection()?.removeAllRanges();
  };

  return (
    <ExamShell
      fill
      partLabel="Reading"
      title={paper.title}
      candidateName={session.name}
      candidateNumber={session.candidateNumber}
      clock={formatClock(left)}
      alert={alert}
      locked={locked}
    >
      <div className="grid h-full min-h-0 grid-cols-2">
        <div
          data-testid="reading-passage"
          className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white px-6 py-6 space-y-8"
        >
          {paper.passages.map((passage) => (
            <article key={passage.id}>
              <h2 className="text-base font-bold text-slate-900">{passage.title}</h2>
              <div
                className="mt-3 text-sm leading-7 text-slate-800 whitespace-pre-wrap"
                onMouseUp={(event) => {
                  if (locked) return;
                  const root = event.currentTarget;
                  const selection = window.getSelection();
                  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
                  if (!selection.anchorNode || !root.contains(selection.anchorNode)) return;
                  const quote = selection.toString();
                  if (!quote.trim()) return;
                  const range = selection.getRangeAt(0);
                  const start = textOffset(root, range.startContainer, range.startOffset);
                  const end = textOffset(root, range.endContainer, range.endOffset);
                  if (end <= start) return;
                  setNoteOpen(false);
                  setNoteDraft("");
                  setPopup({
                    x: Math.min(event.clientX, window.innerWidth - 190),
                    y: Math.min(event.clientY + 8, window.innerHeight - 160),
                    passageId: passage.id,
                    start,
                    end,
                  });
                }}
              >
                {renderMarked(passage.text, state.marks.filter((mark) => mark.passageId === passage.id))}
              </div>
            </article>
          ))}
        </div>
        <div data-testid="reading-questions" className="min-h-0 overflow-y-auto px-6 py-6">
          {hydrated ? (
            <ObjectiveQuestions
              questions={questions}
              answers={state.reading}
              disabled={locked}
              onChange={(id, value) => setState((current) => ({ ...current, reading: { ...current.reading, [id]: value } }))}
            />
          ) : (
            <p className="text-sm text-slate-600">Đang khôi phục bài làm…</p>
          )}
        </div>
      </div>
      {popup ? (
        <div
          data-testid="selection-popup"
          className="fixed z-50 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
          style={{ top: popup.y, left: popup.x }}
        >
          <button type="button" data-testid="highlight-btn" onClick={() => addMark("")} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-yellow-50">
            Highlight
          </button>
          <button
            type="button"
            data-testid="notes-btn"
            onClick={() => setNoteOpen(true)}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-blue-50"
          >
            Notes
          </button>
          {noteOpen ? (
            <label className="block px-1 pb-1">
              <span className="sr-only">Ghi chú</span>
              <textarea
                data-testid="note-input"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <button type="button" onClick={() => addMark(noteDraft.trim())} className="mt-1 text-xs font-bold text-blue-700">
                Lưu ghi chú
              </button>
            </label>
          ) : null}
        </div>
      ) : null}
    </ExamShell>
  );
}

function renderMarked(text: string, marks: PassageMark[]) {
  const ordered = [...marks].filter((mark) => mark.start >= 0 && mark.end <= text.length).sort((a, b) => a.start - b.start);
  const nodes: Array<string | ReactNode> = [];
  let cursor = 0;
  for (const mark of ordered) {
    if (mark.start < cursor) continue;
    if (mark.start > cursor) nodes.push(text.slice(cursor, mark.start));
    nodes.push(
      <mark key={mark.id} data-testid="passage-highlight" className="bg-yellow-200" title={mark.note || undefined}>
        {text.slice(mark.start, mark.end)}
        {mark.note ? <sup className="text-blue-800">*</sup> : null}
      </mark>,
    );
    cursor = mark.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function textOffset(root: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  while (walker.nextNode()) {
    const current = walker.currentNode;
    if (current === node) return count + offset;
    count += current.textContent?.length ?? 0;
  }
  return count;
}
