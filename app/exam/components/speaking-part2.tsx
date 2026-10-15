"use client";

import type { Part2Topic } from "@/data/exam_data";

function formatSeconds(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function SpeakingPart2({
  topic,
  mode,
  secondsLeft,
  level,
}: {
  topic: Part2Topic;
  mode: "prep" | "recording";
  secondsLeft: number;
  level: number;
}) {
  const recording = mode === "recording";
  return (
    <section
      data-testid="speaking-part2"
      aria-labelledby="speaking-part2-title"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p data-testid="speaking-part-progress" className="text-xs font-bold uppercase tracking-wide text-amber-800">
          Part 2
        </p>
        <p
          data-testid={recording ? "speaking-part2-recording" : "speaking-part2-prep"}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
            recording ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {recording ? (
            <span data-testid="speaking-record-dot" className="h-3 w-3 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
          ) : null}
          {recording ? "Đang ghi" : "Chuẩn bị — micro tắt"}
        </p>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <h2 id="speaking-part2-title" className="text-lg font-bold text-slate-900">
          {recording ? "Hãy nói về cue card" : "1 phút chuẩn bị"}
        </h2>
        <p
          data-testid="speaking-part2-timer"
          aria-live="polite"
          className={`font-mono text-4xl font-black tabular-nums ${recording && secondsLeft <= 10 ? "animate-pulse text-red-600" : "text-slate-900"}`}
        >
          {formatSeconds(secondsLeft)}
        </p>
      </div>

      <div data-testid="speaking-part2-cue" className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-800">Candidate task card</p>
        {topic.imageUrl ? (
          // Cue art is an admin-supplied URL. next/image would need a remote allow-list for every host.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            data-testid="speaking-part2-image"
            src={topic.imageUrl}
            alt=""
            className="mt-4 max-h-64 w-full rounded-xl border border-amber-200 bg-white object-contain"
          />
        ) : (
          <div data-testid="speaking-part2-text" className="mt-4">
            <h3 className="text-base font-bold text-slate-900">{topic.topicTitle}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-800">{topic.taskCardPrompt}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
              {topic.bulletPoints.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {recording ? (
        <div data-testid="speaking-level-meter" className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>Mức micro</span>
            <span className="font-mono text-slate-900">{level}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
            <div className="h-full rounded-full bg-red-600 transition-[width] duration-75" style={{ width: `${Math.max(4, Math.min(100, level))}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-600">Hết giờ sẽ có một tiếng bíp, rồi máy ghi 2 phút liên tục.</p>
      )}
    </section>
  );
}
