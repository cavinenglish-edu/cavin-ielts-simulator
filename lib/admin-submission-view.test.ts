import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SIGNED_AUDIO_TTL_SECONDS,
  UNMARKED_RESULT,
  absoluteStorageUrl,
  canRemarkSubmission,
  paperTitleFor,
  parseSubmissionRecord,
  remarkNotice,
  retryStoredMark,
  signClipUrls,
  submissionResultLabel,
  toAdminDetail,
  toAdminListItem,
  type RemarkIO,
} from "./admin-submission-view";
import { MARKING_FAILED, MISSING_AI_KEY, NO_AUDIO, type SpeakingMark, type WritingMark } from "./exam-marking";
import { PRACTICE_MIX_ID } from "./exam-catalog";

const id = "11111111-1111-4111-8111-111111111111";

const writingMark: WritingMark = {
  status: "marked",
  task1: [{ key: "taskAchievement", label: "Task Achievement", score: 6, comment: "Đủ ý chính." }],
  task2: [{ key: "taskResponse", label: "Task Response", score: 7, comment: "Trả lời đủ hai vế." }],
  task1Band: 6,
  task2Band: 7,
  overall: 6.5,
  chart: "seen",
};

const speakingMark: SpeakingMark = {
  status: "marked",
  criteria: [{ key: "pronunciation", label: "Pronunciation", score: 6, comment: "Âm rõ." }],
  overall: 6,
};

const writingPayload = {
  task1: {
    prompt: "The chart shows boat traffic.",
    imageUrl: "https://cdn.example/chart.png",
    essay: "The harbour was busier in the morning.",
  },
  task2: {
    prompt: "Discuss both views.",
    essay: "Cities should keep a working harbour.",
  },
};

function io(overrides: Partial<RemarkIO> = {}): RemarkIO & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    readKey: () => "test-key",
    markWriting: async () => {
      calls.push("writing");
      return writingMark;
    },
    markSpeaking: async () => {
      calls.push("speaking");
      return speakingMark;
    },
    loadAudio: async () => {
      calls.push("audio");
      return [{ part: 1, questionIndex: 0, mimeType: "audio/webm", base64: "AAAA" }];
    },
    questions: async () => [],
    ...overrides,
  };
}

describe("submission result labels", () => {
  it("shows listening and reading as correct/total plus the band", () => {
    assert.equal(
      submissionResultLabel({
        skill: "listening",
        markingStatus: "scored",
        score: { correct: 30, total: 40, band: 7, estimated: false },
      }),
      "30/40 · band 7.0",
    );
    assert.equal(
      submissionResultLabel({
        skill: "reading",
        markingStatus: "scored",
        score: { correct: 3, total: 6, band: 5, estimated: true },
      }),
      "3/6 · band 5.0 (ước lượng)",
    );
  });

  it("shows a band when writing or speaking was marked, and chưa chấm được when it was not", () => {
    assert.equal(submissionResultLabel({ skill: "writing", markingStatus: "marked", score: { overall: 6.5 } }), "Band 6.5");
    assert.equal(submissionResultLabel({ skill: "speaking", markingStatus: "marked", score: { overall: 6 } }), "Band 6.0");
    for (const status of ["marking_failed", "pending_key", "no_audio", "no_transcript", "saved"]) {
      assert.equal(submissionResultLabel({ skill: "writing", markingStatus: status, score: null }), UNMARKED_RESULT);
      assert.equal(submissionResultLabel({ skill: "speaking", markingStatus: status, score: null }), UNMARKED_RESULT);
    }
  });

  it("offers Chấm lại only for unmarked or failed writing and speaking", () => {
    assert.equal(canRemarkSubmission("listening", "scored"), false);
    assert.equal(canRemarkSubmission("reading", "scored"), false);
    assert.equal(canRemarkSubmission("writing", "marked"), false);
    assert.equal(canRemarkSubmission("speaking", "marked"), false);
    assert.equal(canRemarkSubmission("writing", "marking_failed"), true);
    assert.equal(canRemarkSubmission("writing", "pending_key"), true);
    assert.equal(canRemarkSubmission("speaking", "no_audio"), true);
    assert.equal(canRemarkSubmission("speaking", "saved"), true);
  });
});

describe("retry marking", () => {
  it("replaces a writing band and sends the Task 1 image URL through", async () => {
    let seen = "";
    const marker = io({
      markWriting: async (input) => {
        seen = input.task1ImageUrl ?? "";
        return writingMark;
      },
    });
    const result = await retryStoredMark(
      {
        skill: "writing",
        markingStatus: "marking_failed",
        candidateNumber: "VN102-1",
        paperId: "paper-1",
        payload: writingPayload,
      },
      marker,
    );
    assert.equal(seen, "https://cdn.example/chart.png");
    assert.equal(result.code, "marked");
    assert.equal(result.band, 6.5);
    assert.equal(result.patch?.marking_status, "marked");
    assert.equal(result.patch?.score && "overall" in result.patch.score ? result.patch.score.overall : null, 6.5);
  });

  it("keeps chưa chấm được and does not invent a score when Gemini fails", async () => {
    const marker = io({
      markWriting: async () => null,
    });
    const result = await retryStoredMark(
      {
        skill: "writing",
        markingStatus: "marking_failed",
        candidateNumber: "VN102-1",
        paperId: "paper-1",
        payload: writingPayload,
      },
      marker,
    );
    assert.equal(result.code, "failed");
    assert.equal(result.message, MARKING_FAILED);
    assert.equal(result.patch?.score, null);
    assert.equal(result.band, undefined);
    assert.equal(JSON.stringify(result.patch).includes("overall"), false);
    assert.equal(
      submissionResultLabel({ skill: "writing", markingStatus: result.patch?.marking_status ?? "saved", score: result.patch?.score ?? null }),
      UNMARKED_RESULT,
    );
  });

  it("does not call Gemini for listening, a missing key, or speaking without audio", async () => {
    const listening = io();
    const denied = await retryStoredMark(
      { skill: "listening", markingStatus: "scored", candidateNumber: "VN102-1", paperId: "paper-1", payload: {} },
      listening,
    );
    assert.equal(denied.patch, null);
    assert.deepEqual(listening.calls, []);

    let called = false;
    const missingKey = await retryStoredMark(
      { skill: "writing", markingStatus: "pending_key", candidateNumber: "VN102-1", paperId: "paper-1", payload: writingPayload },
      io({
        readKey: () => null,
        markWriting: async () => {
          called = true;
          return writingMark;
        },
      }),
    );
    assert.equal(called, false);
    assert.equal(missingKey.patch?.score, null);
    assert.equal(missingKey.message, MISSING_AI_KEY);

    const silent = await retryStoredMark(
      {
        skill: "speaking",
        markingStatus: "no_audio",
        candidateNumber: "VN102849201",
        paperId: "paper-1",
        payload: { recordings: [{ part: 1, questionIndex: 0, path: "VN102849201/paper-1/part-1-q-0-clip.webm", transcript: "" }] },
      },
      io({
        loadAudio: async () => null,
        markSpeaking: async () => {
          called = true;
          return speakingMark;
        },
      }),
    );
    assert.equal(called, false);
    assert.equal(silent.message, NO_AUDIO);
    assert.equal(silent.patch?.score, null);
  });

  it("sends speaking audio bytes to the marker", async () => {
    let bytes = "";
    const result = await retryStoredMark(
      {
        skill: "speaking",
        markingStatus: "marking_failed",
        candidateNumber: "VN102849201",
        paperId: "paper-1",
        payload: { recordings: [{ part: 1, questionIndex: 0, path: "VN102849201/paper-1/part-1-q-0-clip.webm", transcript: "" }] },
      },
      io({
        loadAudio: async () => [{ part: 1, questionIndex: 0, mimeType: "audio/webm", base64: "AAAA" }],
        markSpeaking: async (input) => {
          bytes = input.clips[0]?.base64 ?? "";
          return speakingMark;
        },
      }),
    );
    assert.equal(bytes, "AAAA");
    assert.equal(result.patch?.marking_status, "marked");
    assert.equal(result.band, 6);
  });
});

describe("admin view", () => {
  it("drops the phone and any extra secret fields", () => {
    const row = parseSubmissionRecord({
      id,
      paper_id: "paper-1",
      candidate_number: "VN102-1",
      candidate_name: "Nguyễn A",
      phone: "0901234567",
      service_role: "secret-role",
      skill: "listening",
      section_started_at: "1000",
      payload: { answers: {} },
      score: { correct: 30, total: 40, band: 7, items: [{ id: "l1", prompt: "Name", given: "Anna", expected: "Anna", ok: true }] },
      marking_status: "scored",
      created_at: "2026-10-16T03:30:00.000Z",
    });
    assert.ok(row);
    const list = toAdminListItem(row, "Harbour");
    const detail = toAdminDetail({ row, paperTitle: "Harbour", audioUrls: new Map(), questions: [] });
    const packed = JSON.stringify({ list, detail, row });
    assert.equal(packed.includes("0901234567"), false);
    assert.equal(packed.includes("secret-role"), false);
    assert.equal(list.resultLabel, "30/40 · band 7.0");
    assert.equal(detail.answers[0]?.expected, "Anna");
    assert.equal(list.timeLabel.includes("10:30"), true);
  });

  it("names the practice mix and signs only safe https audio urls", async () => {
    assert.equal(paperTitleFor(PRACTICE_MIX_ID, new Map()), "Luyện trộn");
    assert.equal(paperTitleFor("missing", new Map()), "Đề không còn trong thư viện");
    let expires = 0;
    let asked: string[] = [];
    const urls = await signClipUrls(
      ["../secret.webm", "javascript:alert(1)", "VN102849201/paper-1/part-1-q-0-clip.webm", "https://evil.example/a.webm"],
      async (paths, ttl) => {
        asked = paths;
        expires = ttl;
        return [
          { path: paths[0] ?? "", url: "https://cdn.example/storage/v1/object/sign/speaking-recordings/clip?token=short" },
          { path: "../secret.webm", url: "https://cdn.example/secret" },
          { path: "VN102849201/paper-1/part-1-q-0-clip.webm", url: "javascript:alert(1)" },
        ];
      },
    );
    assert.deepEqual(asked, ["VN102849201/paper-1/part-1-q-0-clip.webm"]);
    assert.equal(expires, SIGNED_AUDIO_TTL_SECONDS);
    assert.equal(urls.size, 1);
    assert.equal(urls.get("VN102849201/paper-1/part-1-q-0-clip.webm")?.startsWith("https://"), true);
    assert.equal(
      absoluteStorageUrl("/object/sign/speaking-recordings/clip?token=short", "/object/sign/speaking-recordings/clip?token=short", "https://project.supabase.co"),
      "https://project.supabase.co/storage/v1/object/sign/speaking-recordings/clip?token=short",
    );
  });

  it("ignores a remark code that is not one of ours", () => {
    assert.equal(remarkNotice("<script>", "9"), null);
    assert.equal(remarkNotice("marked", "6.5")?.text, "Đã chấm lại. Band 6.5.");
    assert.equal(remarkNotice("failed", undefined)?.text, MARKING_FAILED);
  });
});
