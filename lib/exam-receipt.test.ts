import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReceipt, receiptKind } from "./exam-receipt";
import { NO_AUDIO } from "./exam-marking";

const listening = {
  skill: "listening",
  marking_status: "scored",
  section_started_at: 1,
  score: {
    correct: 30,
    total: 40,
    band: 7,
    estimated: false,
    scaledRaw: 30,
    items: [{ id: "l1", prompt: "Name", given: "Anna", expected: "Anna", ok: true }],
  },
};

describe("receipt bands", () => {
  it("shows four bands and the rounded overall for an actual sitting", () => {
    const receipt = buildReceipt(
      "actual",
      [
        listening,
        { skill: "reading", marking_status: "scored", section_started_at: 2, score: { correct: 32, total: 40, band: 7, estimated: false, scaledRaw: 32, items: [] } },
        { skill: "writing", marking_status: "marked", section_started_at: 3, score: { overall: 6.5, chart: "unseen" } },
        { skill: "speaking", marking_status: "marked", section_started_at: 4, score: { overall: 6.5 } },
      ],
      true,
    );
    assert.equal(receipt.overall, 7);
    assert.deepEqual(
      receipt.submissions.map((line) => line.band),
      [7, 7, 6.5, 6.5],
    );
    assert.match(receipt.submissions[2]?.note ?? "", /không được nhìn thấy/);
    assert.equal(receipt.submissions[0]?.items?.[0]?.expected, "Anna");
  });

  it("hides the answer key until the sitting is finished", () => {
    const hidden = buildReceipt("actual", [listening], false);
    assert.equal(hidden.submissions[0]?.items, undefined);
    assert.equal(hidden.overall, null);
  });

  it("keeps luyện trộn to three skills and forecast to speaking", () => {
    const rows = [
      listening,
      { skill: "reading", marking_status: "scored", section_started_at: 2, score: { correct: 3, total: 6, items: [{ id: "r1", prompt: "Side", given: "north", expected: "north", ok: true }] } },
      { skill: "writing", marking_status: "marked", section_started_at: 3, score: { overall: 6 } },
      { skill: "speaking", marking_status: "marked", section_started_at: 4, score: { overall: 7 } },
    ];
    const mix = buildReceipt("mix", rows, true);
    assert.deepEqual(mix.submissions.map((line) => line.skill), ["listening", "reading", "writing"]);
    assert.equal(mix.overall, null);
    assert.equal(mix.submissions[1]?.estimated, true);
    assert.equal(mix.submissions[1]?.band, 5.5);

    const forecast = buildReceipt("forecast", rows, true);
    assert.deepEqual(forecast.submissions.map((line) => line.skill), ["speaking"]);
    assert.equal(forecast.overall, null);
    assert.equal(receiptKind("practice-mix", "actual"), "mix");
    assert.equal(receiptKind("paper", "forecast"), "forecast");
  });

  it("does not invent an overall when speaking was not heard", () => {
    const receipt = buildReceipt(
      "actual",
      [listening, { skill: "speaking", marking_status: "no_audio", section_started_at: 4, score: null }],
      true,
    );
    assert.equal(receipt.overall, null);
    assert.equal(receipt.submissions.find((line) => line.skill === "speaking")?.note, NO_AUDIO);
    assert.equal(receipt.submissions.find((line) => line.skill === "speaking")?.band, undefined);
  });
});
