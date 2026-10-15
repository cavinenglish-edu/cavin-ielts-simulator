import type { SubmitView } from "@/lib/exam-submit";
import { ScoreResult } from "@/app/exam/components/objective-questions";

export function SubmissionNotice({ view }: { view: SubmitView | null }) {
  if (!view) return null;
  if (!view.ok || !view.stored) {
    return (
      <p data-testid="submission-error" role="alert" className="bg-red-700 px-4 py-2 text-center text-sm font-bold text-white">
        {view.message}
      </p>
    );
  }
  const writing = view.writing;
  const speaking = view.speaking;
  return (
    <div className="bg-white px-4 py-4">
      <p data-testid="paper-sent" className="text-center text-sm font-bold text-emerald-800">
        Bài đã được gửi.
      </p>
      {view.objective ? <div className="mx-auto mt-3 max-w-3xl"><ScoreResult {...view.objective} /></div> : null}
      {writing && "overall" in writing ? (
        <div data-testid="writing-band" className="mx-auto mt-3 max-w-3xl space-y-3 text-sm text-slate-800">
          <p className="text-2xl font-black text-slate-900">Điểm Writing {writing.overall.toFixed(1)}</p>
          <CriterionList title={`Task 1 — ${writing.task1Band.toFixed(1)}`} items={writing.task1} />
          <CriterionList title={`Task 2 — ${writing.task2Band.toFixed(1)}`} items={writing.task2} />
        </div>
      ) : null}
      {writing && !("overall" in writing) ? (
        <p data-testid="marking-note" className="mt-2 text-center text-sm font-semibold text-slate-800">
          {writing.message}
        </p>
      ) : null}
      {speaking && "overall" in speaking ? (
        <div data-testid="speaking-band" className="mx-auto mt-3 max-w-3xl space-y-3 text-sm text-slate-800">
          <p className="text-2xl font-black text-slate-900">Điểm Speaking {speaking.overall.toFixed(1)}</p>
          <CriterionList title="Bốn tiêu chí" items={speaking.criteria} />
        </div>
      ) : null}
      {speaking && !("overall" in speaking) ? (
        <p data-testid="marking-note" className="mt-2 text-center text-sm font-semibold text-slate-800">
          {speaking.message}
        </p>
      ) : null}
    </div>
  );
}

function CriterionList({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; label: string; score: number; comment: string }>;
}) {
  return (
    <section>
      <h3 className="font-bold text-slate-900">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={`${title}-${item.key}`} className="border border-slate-200 px-3 py-2">
            <p className="font-semibold">
              {item.label}: {item.score.toFixed(1)}
            </p>
            <p>{item.comment}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
