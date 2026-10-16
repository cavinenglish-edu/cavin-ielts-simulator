import { TFNG_OPTIONS } from "@/lib/exam-skill";
import { examBlanks } from "@/lib/form-table";
import type { ClientQuestion } from "@/lib/exam-paper-view";
import { FormTableView } from "@/app/exam/components/form-table-view";

export function ObjectiveQuestions({
  questions,
  answers,
  onChange,
  disabled,
  startIndex = 0,
}: {
  questions: ClientQuestion[];
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
  startIndex?: number;
}) {
  const numbered = questions.reduce<Array<{ question: ClientQuestion; numbers: number[] }>>((items, question) => {
    const used = items.reduce((sum, item) => sum + item.numbers.length, startIndex);
    const numbers = examBlanks([question]).map((_, index) => used + index + 1);
    return [...items, { question, numbers }];
  }, []);
  return (
    <div className="space-y-4">
      {numbered.map(({ question, numbers }) => {
        if (question.type === "form_table") {
          return (
            <FormTableView
              key={question.id}
              group={question}
              numbers={numbers}
              answers={answers}
              disabled={disabled}
              onChange={onChange}
            />
          );
        }
        const number = numbers[0] ?? startIndex + 1;
        const choice =
          question.type === "multiple_choice" ||
          question.type === "matching" ||
          question.type === "true_false_not_given";
        const options = question.type === "true_false_not_given" ? [...TFNG_OPTIONS] : question.options ?? [];
        return (
          <article id={`question-${question.id}`} key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {number}. {question.prompt}
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
                data-testid={number === 1 ? "short-answer" : undefined}
                disabled={disabled}
                value={answers[question.id] ?? ""}
                onChange={(event) => onChange(question.id, event.target.value)}
                className="mt-3 w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
