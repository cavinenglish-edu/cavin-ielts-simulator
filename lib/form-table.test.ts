import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { examBlanks, parseNoteGaps } from "./form-table";
import { paperInputSchema, preparePaperInput } from "./ielts-paper";
import { scoreObjective } from "./ielts-score";

describe("form table", () => {
  it("numbers table rows before note gaps and keeps the other question types", () => {
    const parsed = paperInputSchema.parse(
      preparePaperInput({
        skill: "listening",
        title: "Form",
        status: "published",
        sections: [
          {
            id: "s1",
            title: "Section 1",
            audioUrl: "https://cdn.example.com/a.mp3",
            questions: [
              { id: "q1", type: "short_text", prompt: "Name?", answer: "Anna" },
              {
                id: "form",
                type: "form_table",
                title: "Buying a Used Car",
                rows: [
                  { id: "model", label: "Model", answer: "Corolla" },
                  { id: "year", label: "Year", answer: "2012" },
                  { id: "blank", label: " ", answer: " " },
                ],
                note: "The seller lives in {{1}}.",
                gaps: [{ id: "gap1", marker: 1, answer: "Hue|Huế" }],
              },
              {
                id: "q2",
                type: "true_false_not_given",
                prompt: "The car is new.",
                answer: "False",
              },
            ],
          },
        ],
      }),
    );
    assert.equal(parsed.skill, "listening");
    if (parsed.skill !== "listening") return;
    const questions = parsed.sections[0]?.questions ?? [];
    assert.deepEqual(
      examBlanks(questions).map((blank) => blank.id),
      ["q1", "model", "year", "gap1", "q2"],
    );
    assert.deepEqual(parseNoteGaps("See {{1}} and {{ 2 }} and {{1}}."), [1, 2]);
    const score = scoreObjective(questions, {
      q1: " anna ",
      model: "corolla",
      year: "2011",
      gap1: "HUẾ",
      q2: "F",
    });
    assert.equal(score.total, 5);
    assert.equal(score.correct, 4);
    assert.equal(score.items.find((item) => item.id === "year")?.ok, false);
  });
});
