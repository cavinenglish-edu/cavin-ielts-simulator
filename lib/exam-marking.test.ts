import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fourSkillOverall,
  markSpeakingAudio,
  markWritingEssays,
  markingModelName,
  MISSING_AI_KEY,
  parseSpeakingMark,
  parseWritingMark,
  readModelKey,
  roundToHalf,
  speakingPromptParts,
  SPEAKING_AUDIO_MODEL,
  writingOverallBand,
  writingRequestParts,
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

  it("rounds .25 and .75 up, including the four-skill mean", () => {
    assert.equal(roundToHalf(6.25), 6.5);
    assert.equal(roundToHalf(6.75), 7);
    assert.equal(roundToHalf(6.24), 6);
    assert.equal(fourSkillOverall([7, 6, 6, 6]), 6.5);
    assert.equal(fourSkillOverall([8, 7, 6, 6]), 7);
    assert.equal(fourSkillOverall([7, 6.5, 6, null]), null);
  });
});

const writingReply = JSON.stringify({
  task1: {
    taskAchievement: 6,
    coherenceCohesion: 6,
    lexicalResource: 6,
    grammaticalRangeAccuracy: 6,
    comments: {
      taskAchievement: "Đủ ý chính.",
      coherenceCohesion: "Mạch lạc.",
      lexicalResource: "Từ vựng ổn.",
      grammaticalRangeAccuracy: "Còn lỗi nhỏ.",
    },
  },
  task2: {
    taskResponse: 7,
    coherenceCohesion: 6,
    lexicalResource: 6,
    grammaticalRangeAccuracy: 6,
    comments: {
      taskResponse: "Trả lời đủ hai vế.",
      coherenceCohesion: "Liên kết rõ.",
      lexicalResource: "Từ đa dạng.",
      grammaticalRangeAccuracy: "Câu phức ổn.",
    },
  },
});

const essay = {
  task1Prompt: "The chart shows boat traffic.",
  task1Essay: "The harbour was busier in the morning.",
  task2Prompt: "Discuss both views.",
  task2Essay: "Cities should keep a working harbour.",
};

describe("writing chart bytes", () => {
  it("attaches the chart image and still marks from the prompt when the image is missing", async () => {
    const seen = writingRequestParts({ ...essay, task1ImageUrl: "https://cdn.example/chart.png" }, { mimeType: "image/png", data: "abc" });
    assert.equal(seen.chart, "seen");
    assert.equal("inlineData" in seen.parts[0], true);

    let loaded = false;
    const missed = await markWritingEssays({ ...essay, task1ImageUrl: "https://cdn.example/chart.png" }, "key", {
      loadChart: async () => {
        loaded = true;
        return null;
      },
      complete: async (parts) => {
        assert.equal(parts.some((part) => "inlineData" in part), false);
        const text = parts.map((part) => ("text" in part ? part.text : "")).join("\n");
        assert.match(text, /could not be loaded/);
        return writingReply;
      },
    });
    assert.equal(loaded, true);
    assert.equal(missed?.chart, "unseen");
    assert.equal(missed?.overall, 6.5);
  });

  it("does not invent a writing band when the model reply is empty", async () => {
    const marked = await markWritingEssays(essay, "key", {
      complete: async () => null,
    });
    assert.equal(marked, null);
    assert.equal(markingModelName({}), SPEAKING_AUDIO_MODEL);
  });
});

describe("speaking audio", () => {
  it("sends the recording bytes and refuses to score pronunciation from text alone", async () => {
    const parts = speakingPromptParts({
      clips: [{ part: 1, questionIndex: 0, mimeType: "audio/webm", base64: "b2s=" }],
      questions: [{ part: 1, questionIndex: 0, question: "What time do you get up?" }],
    });
    assert.ok(parts);
    const text = parts?.map((part) => ("text" in part ? part.text : "")).join("\n") ?? "";
    assert.match(text, /not from a transcript/);
    assert.match(text, /What time do you get up/);
    const audio = parts?.find((part) => "inlineData" in part);
    assert.equal(audio && "inlineData" in audio ? audio.inlineData?.mimeType : "", "audio/webm");

    let called = false;
    const empty = await markSpeakingAudio({ clips: [], questions: [] }, "key", async () => {
      called = true;
      return "{}";
    });
    assert.equal(empty, null);
    assert.equal(called, false);

    const failed = await markSpeakingAudio(
      {
        clips: [{ part: 1, questionIndex: 0, mimeType: "audio/webm", base64: "b2s=" }],
        questions: [],
      },
      "key",
      async () => null,
    );
    assert.equal(failed, null);
  });
});
