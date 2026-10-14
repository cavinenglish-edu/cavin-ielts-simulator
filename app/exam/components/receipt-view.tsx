"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { countWords } from "@/lib/ielts-score";
import type { PublicSession } from "@/lib/exam-sitting";
import { emptyRecovery, parseRecovery, RECOVERY_KEY, type RecoveryState } from "@/lib/sitting-recovery";

export function ReceiptView({ session }: { session: PublicSession }) {
  const [saved, setSaved] = useState<RecoveryState>(() => emptyRecovery(session.paperId));

  useEffect(() => {
    const raw = window.sessionStorage.getItem(RECOVERY_KEY) || window.localStorage.getItem(RECOVERY_KEY);
    const id = window.setTimeout(() => setSaved(parseRecovery(raw, session.paperId)), 0);
    return () => window.clearTimeout(id);
  }, [session.paperId]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <section data-testid="sitting-receipt" className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">IELTS on Computer</p>
        <h1 className="text-2xl font-black text-slate-900">Biên nhận bài thi</h1>
        <p className="text-sm text-slate-700">
          Bài Listening, Reading và Writing đã được lưu. Phiếu này không chấm và không tạo điểm band.
        </p>
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
