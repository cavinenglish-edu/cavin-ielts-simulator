export function QuestionNav({
  questions,
  answers,
}: {
  questions: Array<{ id: string }>;
  answers: Record<string, string>;
}) {
  return (
    <nav
      data-testid="question-nav"
      aria-label="Câu hỏi"
      className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 flex flex-wrap gap-2"
    >
      {questions.map((question, index) => {
        const answered = Boolean(answers[question.id]?.trim());
        return (
          <button
            key={question.id}
            type="button"
            data-testid={`q-nav-${index + 1}`}
            data-answered={answered ? "true" : "false"}
            onClick={() => document.getElementById(`question-${question.id}`)?.scrollIntoView({ block: "center" })}
            className={`h-9 min-w-9 px-2 rounded-lg border-2 text-sm font-bold ${
              answered ? "bg-blue-700 border-blue-700 text-white" : "bg-white border-slate-400 text-slate-800"
            }`}
          >
            {index + 1}
          </button>
        );
      })}
    </nav>
  );
}
