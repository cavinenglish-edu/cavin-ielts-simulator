import { gapsInNoteOrder } from "@/lib/form-table";
import type { ObjectiveQuestion } from "@/lib/exam-skill";

export function normalizeAnswer(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "t" || normalized === "true") return "true";
  if (normalized === "f" || normalized === "false") return "false";
  if (normalized === "ng" || normalized === "not given") return "not given";
  return normalized;
}

export function answersMatch(expected: string, given: string, options?: string[]): boolean {
  const got = normalizeAnswer(given);
  if (!got) return false;
  const accepted = expected
    .split("|")
    .map((part) => normalizeAnswer(part))
    .filter(Boolean);
  if (accepted.some((item) => item === got)) return true;
  if (!options || options.length === 0) return false;

  const letterIndex = (token: string): number => {
    if (token.length !== 1) return -1;
    const code = token.toLowerCase().charCodeAt(0) - 97;
    if (code < 0 || code >= options.length) return -1;
    return code;
  };

  const givenLetter = letterIndex(got);
  if (givenLetter >= 0 && accepted.some((item) => item === normalizeAnswer(options[givenLetter]) || item === got)) {
    return true;
  }

  for (const item of accepted) {
    const expectedLetter = letterIndex(item);
    if (expectedLetter >= 0 && normalizeAnswer(options[expectedLetter]) === got) return true;
  }

  return false;
}

export type ScoreItem = {
  id: string;
  prompt: string;
  given: string;
  expected: string;
  ok: boolean;
};

export function scoreObjective(
  questions: ObjectiveQuestion[],
  answers: Record<string, string>,
): { correct: number; total: number; items: ScoreItem[] } {
  const items: ScoreItem[] = [];
  for (const question of questions) {
    if (question.type === "form_table") {
      for (const row of question.rows) {
        const given = answers[row.id] ?? "";
        items.push({
          id: row.id,
          prompt: row.label,
          given,
          expected: row.answer,
          ok: answersMatch(row.answer, given),
        });
      }
      for (const gap of gapsInNoteOrder(question.note, question.gaps)) {
        const given = answers[gap.id] ?? "";
        items.push({
          id: gap.id,
          prompt: `Chỗ trống ${gap.marker}`,
          given,
          expected: gap.answer,
          ok: answersMatch(gap.answer, given),
        });
      }
      continue;
    }
    const given = answers[question.id] ?? "";
    items.push({
      id: question.id,
      prompt: question.prompt,
      given,
      expected: question.answer,
      ok: answersMatch(question.answer, given, question.options),
    });
  }
  return {
    correct: items.filter((item) => item.ok).length,
    total: items.length,
    items,
  };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
