import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXAM_DATA_SETS, getExamDataSetById } from "../data/exam_data";
import {
  chooseMixIds,
  computerParts,
  isRetiredSpeakingSet,
  mixAvailability,
  readCatalog,
  toLibraryPaper,
} from "./exam-catalog";

const listening = { sections: [{ id: "s1", title: "Section 1", audioUrl: "https://cdn.example.com/a.mp3", questions: [] }] };
const reading = { passages: [{ id: "p1", title: "Passage", text: "Text", questions: [] }] };
const writing = { task1: { prompt: "Chart" }, task2: { prompt: "Essay" } };

describe("retired speaking sets", () => {
  it("keeps the bundled catalog empty", () => {
    assert.deepEqual(EXAM_DATA_SETS, []);
    assert.equal(getExamDataSetById("forecast-2026-travel"), undefined);
  });

  it("matches both id and the duplicate title", () => {
    assert.equal(isRetiredSpeakingSet("forecast-2026-travel", "anything"), true);
    assert.equal(isRetiredSpeakingSet("other-id", "Bộ đề 04: Inspiring People, Mentorship & Culture"), true);
    assert.equal(isRetiredSpeakingSet("other-id", "  Inspiring People, Mentorship & Culture "), true);
    assert.equal(isRetiredSpeakingSet("new-paper", "Harbour sitting"), false);
  });

  it("drops retired rows from the library", () => {
    assert.equal(
      toLibraryPaper({
        id: "11111111-1111-1111-1111-111111111111",
        title: "Bộ đề 04: Inspiring People, Mentorship & Culture",
        skill: "speaking",
      }),
      null,
    );
  });
});

describe("catalog modes", () => {
  it("does not treat a static id prefix as forecast", () => {
    const paper = toLibraryPaper({
      id: "static-harbour",
      title: "Harbour",
      skill: "listening",
      paper: { catalog: "actual", ...listening, ...reading, ...writing },
    });
    assert.equal(paper?.catalog, "actual");
    assert.equal(paper?.mode, "computer");
  });

  it("keeps forecast papers out of the mix", () => {
    const rows = [
      { id: "a", catalog: "actual" as const, listening: true, reading: true, writing: true },
      { id: "b", catalog: "forecast" as const, listening: true, reading: true, writing: true },
      { id: "c", catalog: "forecast" as const, listening: true, reading: true, writing: true },
    ];
    assert.equal(chooseMixIds(rows), null);
    assert.equal(mixAvailability(rows).ready, false);
  });

  it("mixes listening, reading, and writing from three different actual papers", () => {
    const chosen = chooseMixIds([
      { id: "a", catalog: "actual", listening: true, reading: true, writing: false },
      { id: "b", catalog: "actual", listening: false, reading: true, writing: true },
      { id: "c", catalog: "actual", listening: true, reading: false, writing: true },
    ]);
    assert.deepEqual(chosen, { listeningId: "a", readingId: "b", writingId: "c" });
  });

  it("reads an explicit forecast mark even on a speaking topic", () => {
    assert.equal(readCatalog({ catalog: "forecast" }, "speaking"), "forecast");
    assert.equal(readCatalog({}, "speaking"), "forecast");
    assert.equal(readCatalog({}, "listening"), "actual");
    assert.equal(computerParts({ ...listening, ...reading, ...writing }).writing, true);
  });
});
