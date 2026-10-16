"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { countWords } from "@/lib/ielts-score";
import type { PublicSession } from "@/lib/exam-sitting";
import { emptyRecovery, parseRecovery, RECOVERY_KEY, type RecoveryState } from "@/lib/sitting-recovery";

const SKILL_LABEL: Record<string, string> = {
  listening: "Nghe",
  reading: "Đọc",
  writing: "Viết",
  speaking: "Nói",
};

type ReceiptItem = {
  id: string;
  prompt: string;
  given: string;
  expected: string;
  ok: boolean;
};

type ReceiptCriterion = {
  key: string;
  label: string;
  score: number;
  comment: string;
};

type SavedLine = {
  skill: string;
  headline: string;
  note: string;
  correct?: number;
  total?: number;
  band?: number;
  estimated?: boolean;
  scaledRaw?: number;
  items?: ReceiptItem[];
  criteria?: ReceiptCriterion[];
};

type ReceiptPayload = {
  kind?: "actual" | "mix" | "forecast";
  overall?: number | null;
  submissions?: SavedLine[];
};

export function ReceiptView({ session }: { session: PublicSession }) {
  const [saved, setSaved] = useState<RecoveryState>(() => emptyRecovery(session.paperId));
  const [receipt, setReceipt] = useState<ReceiptPayload>({});

  useEffect(() => {
    const raw = window.sessionStorage.getItem(RECOVERY_KEY) || window.localStorage.getItem(RECOVERY_KEY);
    const id = window.setTimeout(() => setSaved(parseRecovery(raw, session.paperId)), 0);
    return () => window.clearTimeout(id);
  }, [session.paperId]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/exam/submissions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as ReceiptPayload;
        if (!cancelled) setReceipt(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const lines = (receipt.submissions ?? []).filter((line) => {
    if (receipt.kind === "mix") return line.skill !== "speaking";
    if (receipt.kind === "forecast") return line.skill === "speaking";
    return true;
  });
  const overall = receipt.kind === "actual" && typeof receipt.overall === "number" ? receipt.overall : null;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <section data-testid="sitting-receipt" className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">IELTS on Computer</p>
        <h1 className="text-2xl font-black text-slate-900">Biên nhận bài thi</h1>
        <p data-testid="paper-sent" className="text-sm font-semibold text-emerald-800">
          {lines.length > 0 ? "Bài đã được gửi." : "Bài Writing vẫn nằm trên máy này cho đến khi máy chủ nhận được."}
        </p>
        {overall !== null ? (
          <p data-testid="receipt-overall" className="text-3xl font-black text-slate-900">
            Điểm tổng {overall.toFixed(1)}
          </p>
        ) : null}
        {lines.length > 0 ? (
          <ul className="space-y-4 text-sm text-slate-800">
            {lines.map((line) => (
              <li key={line.skill} className="border border-slate-200 px-4 py-3">
                <p className="font-bold uppercase">{SKILL_LABEL[line.skill] ?? line.skill}</p>
                {typeof line.band === "number" ? (
                  <p data-testid={`receipt-band-${line.skill}`} className="text-2xl font-black text-slate-900">
                    Band {line.band.toFixed(1)}
                  </p>
                ) : null}
                {typeof line.correct === "number" && typeof line.total === "number" ? (
                  <p data-testid={`receipt-score-${line.skill}`}>
                    {line.correct}/{line.total}
                  </p>
                ) : null}
                {line.estimated ? (
                  <p data-testid={`receipt-estimate-${line.skill}`} className="font-semibold text-slate-700">
                    ước lượng{typeof line.scaledRaw === "number" ? ` · quy về ${line.scaledRaw}/40` : ""}
                  </p>
                ) : null}
                {line.note ? <p data-testid={`receipt-note-${line.skill}`}>{line.note}</p> : null}
                {line.criteria && line.criteria.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {line.criteria.map((item) => (
                      <li key={item.key} className="border border-slate-200 px-3 py-2">
                        <p className="font-semibold">
                          {item.label}: {item.score.toFixed(1)}
                        </p>
                        <p>{item.comment}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {line.items && line.items.length > 0 ? (
                  <ul data-testid={`receipt-key-${line.skill}`} className="mt-3 space-y-2">
                    {line.items.map((item) => (
                      <li key={item.id} className="border border-slate-200 px-3 py-2">
                        <p className="font-semibold text-slate-900">{item.prompt}</p>
                        <p className={item.ok ? "text-emerald-800" : "text-red-800"}>
                          {item.ok ? "Đúng" : "Sai"} — bạn: {item.given || "(trống)"} — đáp án: {item.expected}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Thí sinh</dt>
            <dd className="font-bold text-slate-900">{session.name || "Thí sinh"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Số báo danh</dt>
            <dd className="font-mono font-bold text-blue-800">{session.candidateNumber}</dd>
          </div>
        </dl>
        <article className="border-t border-slate-100 pt-4">
          <h2 className="font-bold text-slate-900">Task 1 — {countWords(saved.task1)} từ</h2>
          <p data-testid="receipt-task1" className="mt-2 text-sm whitespace-pre-wrap text-slate-800">{saved.task1 || "(chưa viết)"}</p>
        </article>
        <article className="border-t border-slate-100 pt-4">
          <h2 className="font-bold text-slate-900">Task 2 — {countWords(saved.task2)} từ</h2>
          <p data-testid="receipt-task2" className="mt-2 text-sm whitespace-pre-wrap text-slate-800">{saved.task2 || "(chưa viết)"}</p>
        </article>
        <Link href="/exam" className="inline-block text-sm font-semibold text-blue-700">
          Về thư viện đề
        </Link>
      </section>
    </main>
  );
}
