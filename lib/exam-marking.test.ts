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
            taskResponse: "Câu cities should keep a working harbour trả lời đúng đề, nhưng chưa có ví dụ.",
            coherenceCohesion: "Liên kết rõ.",
            lexicalResource: "Cụm working harbour đúng chủ đề, nhưng từ vựng còn lặp lại.",
            grammaticalRangeAccuracy: "Câu phức ổn.",
          },
        },
      }),
      {
        task1Essay: "The harbour was busier in the morning.",
        task2Essay: "Cities should keep a working harbour.",
      },
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
      taskResponse: "Câu cities should keep a working harbour nêu rõ quan điểm, nhưng ý chưa được phát triển.",
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
        assert.match(text, /diagram was not available/);
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
    assert.equal(parts?.some((part) => "text" in part && part.text?.startsWith("Transcript")), false);

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

  it("scores pronunciation from the sound and does not send a transcript", () => {
    const parts = speakingPromptParts({
      clips: [{ part: 2, questionIndex: 0, mimeType: "audio/webm", base64: "b2s=" }],
      questions: [{ part: 2, questionIndex: 0, question: "Describe a place you like to visit." }],
    });
    assert.ok(parts);
    const text = parts?.map((part) => ("text" in part ? part.text : "")).join("\n") ?? "";
    assert.match(text, /from the sound/);
    assert.match(text, /intelligibility/);
    assert.match(text, /stress/);
    assert.match(text, /rhythm/);
    assert.match(text, /intonation/);
    assert.match(text, /Accent by itself is not a penalty/);
    assert.match(text, /Do not score pronunciation from a transcript/);
    assert.match(text, /Do not write a transcript/);
    assert.equal(parts?.some((part) => "text" in part && part.text?.startsWith("Transcript")), false);
    assert.equal(parts?.filter((part) => "inlineData" in part).length, 1);
    assert.equal(text.includes("Describe a place you like to visit."), true);
  });
});

function markedWritingReply(task1: { score: number; comment: string }, task2: { score: number; comment: string }): string {
  return JSON.stringify({
    task1: {
      taskAchievement: task1.score,
      coherenceCohesion: 5,
      lexicalResource: 5,
      grammaticalRangeAccuracy: 5,
      comments: {
        taskAchievement: task1.comment,
        coherenceCohesion: "Còn rời.",
        lexicalResource: "Từ ít.",
        grammaticalRangeAccuracy: "Câu đơn.",
      },
    },
    task2: {
      taskResponse: task2.score,
      coherenceCohesion: 5,
      lexicalResource: 5,
      grammaticalRangeAccuracy: 5,
      comments: {
        taskResponse: task2.comment,
        coherenceCohesion: "Liên kết yếu.",
        lexicalResource: "Từ lặp.",
        grammaticalRangeAccuracy: "Lỗi chia thì.",
      },
    },
  });
}

const lowScript = {
  task1Essay: "Boat go morning and evening is different.",
  task2Essay: "I think city is good. People like city because it is nice.",
};

describe("examiner prompts", () => {
  it("includes the under-length rule and the no-inflated-7 rule", () => {
    const text = writingRequestParts(essay, null).parts.map((part) => ("text" in part ? part.text : "")).join("\n");
    assert.match(text, /under 150 words/);
    assert.match(text, /lower Task Achievement/);
    assert.match(text, /under 250 words/);
    assert.match(text, /lower Task Response/);
    assert.match(text, /state the word count/);
    assert.match(text, /features of a 7/);
    assert.match(text, /generous reading of a 6 is not a 7/);
    assert.match(text, /Do not cluster every script at 6\.5 or 7/);
    assert.match(text, /clear overview/);
    assert.match(text, /invented data/);
    assert.match(text, /memorised opening/);
    assert.match(text, /one concrete thing in the script/);
    assert.match(text, /one concrete limit/);
  });

  it("tells the examiner to use the chart when it is attached and to cap Task Achievement when it is not", () => {
    const unseen = writingRequestParts({ ...essay, task1ImageUrl: "https://cdn.example/chart.png" }, null);
    const unseenText = unseen.parts.map((part) => ("text" in part ? part.text : "")).join("\n");
    assert.equal(unseen.chart, "unseen");
    assert.match(unseenText, /Cap Task Achievement at 6\.0/);
    assert.match(unseenText, /diagram was not available/);
    assert.match(unseenText, /Do not invent/);

    const seen = writingRequestParts({ ...essay, task1ImageUrl: "https://cdn.example/chart.png" }, { mimeType: "image/png", data: "abc" });
    const seenText = seen.parts.map((part) => ("text" in part ? part.text : "")).join("\n");
    assert.match(seenText, /what is actually in the image/);
  });
});

describe("examiner score parser", () => {
  it("does not store a 7 for a low script when the comment does not justify it", async () => {
    const praise = markedWritingReply(
      { score: 7, comment: "Bài viết tốt." },
      { score: 7, comment: "Ý rõ ràng." },
    );
    assert.equal(parseWritingMark(praise, lowScript), null);

    const inventedQuote = markedWritingReply(
      { score: 7, comment: "Câu a clear overview of renewable energy có dữ liệu, nhưng chưa đủ chi tiết." },
      { score: 5, comment: "Có vị trí, nhưng ý chưa phát triển." },
    );
    assert.equal(parseWritingMark(inventedQuote, lowScript), null);

    const stored = await markWritingEssays(
      {
        task1Prompt: "The chart shows boat traffic.",
        task1Essay: lowScript.task1Essay,
        task2Prompt: "Discuss both views.",
        task2Essay: lowScript.task2Essay,
      },
      "key",
      { complete: async () => praise },
    );
    assert.equal(stored, null);
  });

  it("keeps a 7 when the comment quotes the script and names a limit", () => {
    const script = {
      task1Essay: "Overall the harbour was busier in the morning than in the evening.",
      task2Essay: "Cities should keep a working harbour because local jobs depend on it.",
    };
    const marked = parseWritingMark(
      markedWritingReply(
        { score: 7, comment: "Câu the harbour was busier in the morning có overview, nhưng chưa so sánh số liệu." },
        { score: 7, comment: "Câu cities should keep a working harbour nêu quan điểm, nhưng chưa phản bác ý đối lập." },
      ),
      script,
    );
    assert.equal(marked?.task1[0]?.score, 7);
    assert.equal(marked?.task2[0]?.score, 7);
  });

  it("caps Task Achievement at 6 when the diagram was not available", async () => {
    const marked = await markWritingEssays(
      { ...essay, task1ImageUrl: "https://cdn.example/chart.png" },
      "key",
      {
        loadChart: async () => null,
        complete: async () =>
          markedWritingReply(
            { score: 7, comment: "Câu the harbour was busier in the morning có một so sánh, nhưng chưa có overview." },
            { score: 6, comment: "Có vị trí, nhưng ý chưa phát triển." },
          ),
      },
    );
    assert.equal(marked?.chart, "unseen");
    assert.equal(marked?.task1[0]?.score, 6);
    assert.match(marked?.task1[0]?.comment ?? "", /Biểu đồ không có để đối chiếu/);
    assert.equal(marked?.task1Band, 5.5);
  });
});
