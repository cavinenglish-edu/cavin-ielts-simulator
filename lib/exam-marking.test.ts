import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MISSING_AI_KEY,
  parseSpeakingMark,
  parseWritingMark,
  readModelKey,
  writingOverallBand,
} from "./exam-marking";

describe("writing band", () => {
  it("weights task 2 double task 1 and rounds to the nearest 0.5", () => {
    assert.equal(writingOverallBand(6, 7), 6.5);
    assert.equal(writingOverallBand(6.5, 7), 7);
    assert.equal(writingOverallBand(5, 5), 5);
  });

  it("rejects a model reply that is not half-band scores with comments", () => {
    assert.equal(parseWritingMark('{"task1":{"taskAchievement":6.2}}'), null);
    const marked = parseWritingMark(
      JSON.stringify({
        task1: {
          taskAchievement: 6,
          coherenceCohesion: 6.5,
          lexicalResource: 6,
          grammaticalRangeAccuracy: 5.5,
          comments: {
            taskAchievement: "Đủ ý chính.",
            coherenceCohesion: "Mạch lạc.",
            lexicalResource: "Từ vựng ổn.",
            grammaticalRangeAccuracy: "Còn lỗi nhỏ.",
          },
        },
        task2: {
          taskResponse: 7,
          coherenceCohesion: 6.5,
          lexicalResource: 7,
          grammaticalRangeAccuracy: 6.5,
          comments: {
            taskResponse: "Trả lời đủ hai vế.",
            coherenceCohesion: "Liên kết rõ.",
            lexicalResource: "Từ đa dạng.",
            grammaticalRangeAccuracy: "Câu phức ổn.",
          },
        },
      }),
    );
    assert.equal(marked?.task1Band, 6);
    assert.equal(marked?.task2Band, 7);
    assert.equal(marked?.overall, 6.5);
  });

  it("does not invent a speaking band when the key or the reply is missing", () => {
    assert.equal(readModelKey({}), null);
    assert.equal(readModelKey({ GEMINI_API_KEY: "  " }), null);
    assert.equal(readModelKey({ GOOGLE_API_KEY: "present" }), "present");
    assert.equal(parseSpeakingMark("{}"), null);
    assert.equal(MISSING_AI_KEY, "chưa chấm được vì thiếu khóa AI");
  });
});
