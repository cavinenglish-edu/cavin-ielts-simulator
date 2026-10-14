import type { ObjectiveQuestion } from "@/lib/exam-skill";
import { TFNG_OPTIONS } from "@/lib/exam-skill";
import type { ScoreItem } from "@/lib/ielts-score";

export function ObjectiveQuestions({
  questions,
  answers,
  onChange,
  disabled,
}: {
  questions: ObjectiveQuestion[];
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <ol className="space-y-4">
      {questions.map((question, index) => {
        const choice =
          question.type === "multiple_choice" ||
          question.type === "matching" ||
          question.type === "true_false_not_given";
        const options =
          question.type === "true_false_not_given" ? [...TFNG_OPTIONS] : question.options ?? [];
        return (
          <li key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {index + 1}. {question.prompt}
            </p>
            {choice ? (
              <fieldset className="mt-3 space-y-2" disabled={disabled}>
                <legend className="sr-only">{question.prompt}</legend>
                {options.map((option) => (
                  <label key={option} className="flex items-center gap-3 text-sm text-slate-800">
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={() => onChange(question.id, option)}
                      className="accent-blue-600"
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
            ) : (
              <input
                aria-label={question.prompt}
                data-testid={index === 0 ? "short-answer" : undefined}
                disabled={disabled}
                value={answers[question.id] ?? ""}
                onChange={(event) => onChange(question.id, event.target.value)}
                className="mt-3 w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ScoreResult({
  correct,
  total,
  items,
}: {
  correct: number;
  total: number;
  items: ScoreItem[];
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Kết quả</h2>
      <p data-testid="raw-score" className="text-3xl font-black text-slate-900">
        {correct}/{total}
      </p>
      <p className="text-sm text-slate-600">Điểm thô trên số câu của đề này.</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
            <p className="font-semibold text-slate-900">{item.prompt}</p>
            <p className={item.ok ? "text-emerald-800" : "text-red-800"}>
              {item.ok ? "Đúng" : "Sai"} — bạn: {item.given || "(trống)"} — đáp án: {item.expected}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
