import type { ReactNode } from "react";
import Link from "next/link";

export function ExamShell({
  partLabel,
  title,
  candidateName,
  candidateNumber,
  clock,
  children,
  alert = "none",
  locked = false,
  fill = false,
}: {
  partLabel: string;
  title: string;
  candidateName: string;
  candidateNumber: string;
  clock: string;
  children: ReactNode;
  alert?: "none" | "10" | "5";
  locked?: boolean;
  fill?: boolean;
}) {
  const timerClass =
    alert === "5" ? "exam-clock-urgent" : alert === "10" ? "exam-clock-warn" : "text-white";
  return (
    <div className={fill ? "h-dvh overflow-hidden bg-slate-100 text-slate-900 flex flex-col" : "min-h-screen bg-slate-100 text-slate-900 flex flex-col"}>
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shrink-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-extrabold tracking-tight shrink-0">
              IELTS <span className="text-red-500">on Computer</span>
            </span>
            <span className="hidden sm:inline text-xs text-slate-300 font-mono truncate">
              Candidate: <strong className="text-white">{candidateName || "Candidate"}</strong>
              {candidateNumber ? ` (${candidateNumber})` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-600">
              {partLabel}
            </span>
            <span
              data-testid="exam-timer"
              data-locked={locked ? "true" : "false"}
              data-alert={alert}
              className={`font-mono font-bold text-sm bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 ${timerClass}`}
            >
              {clock}
            </span>
          </div>
          <Link href="/exam" className="text-xs text-slate-300 hover:text-white shrink-0">
            Thư viện đề
          </Link>
        </div>
      </header>
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between gap-4 text-xs text-slate-600">
          <span>VN102 - Cavin&apos;s English Test Center</span>
          <span className="font-semibold text-slate-800 truncate">{title}</span>
        </div>
      </div>
      {locked ? (
        <div data-testid="section-locked" className="bg-red-700 text-white text-center text-sm font-bold py-2 shrink-0">
          Hết giờ. Bài đã khóa và đang chuyển phần.
        </div>
      ) : null}
      <main className={fill ? "flex-1 min-h-0 overflow-hidden w-full" : "max-w-6xl mx-auto px-6 py-6 flex-1 w-full"}>{children}</main>
    </div>
  );
}

export function RoomStatus({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6">
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600 mt-2">{body}</p>
      <Link href="/exam" className="inline-block mt-4 text-sm font-semibold text-blue-700">
        Quay lại thư viện
      </Link>
    </div>
  );
}
