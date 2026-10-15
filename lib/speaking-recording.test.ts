import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answerSeconds,
  appendAnswer,
  extensionForMime,
  isCaptureActive,
  metadataOnly,
  normalizeAudioMime,
  part2Clock,
  readSpeakingStorageConfig,
  RECORDING_LEAVE_WARNING,
  speakingObjectKey,
} from "./speaking-recording";

describe("speaking recording state", () => {
  it("uses the paper duration when it is set, otherwise 30s and 60s", () => {
    assert.equal(answerSeconds(1, 45), 45);
    assert.equal(answerSeconds(1), 30);
    assert.equal(answerSeconds(3, 40), 40);
    assert.equal(answerSeconds(3), 60);
  });

  it("keeps part 2 at 60 seconds of prep and 120 seconds of recording", () => {
    assert.deepEqual(part2Clock({ prepTimeSeconds: 60, speakTimeSeconds: 120 }), { prep: 60, speak: 120 });
    assert.deepEqual(part2Clock({}), { prep: 60, speak: 120 });
  });

  it("keeps blobs in memory and warns before a reload", () => {
    const blob = new Blob(["clip"], { type: "audio/webm" });
    const answers = appendAnswer([], { part: 2, questionIndex: 0, mimeType: "audio/webm", blob });
    assert.equal(answers[0]?.blob, blob);
    assert.deepEqual(metadataOnly(answers), [{ part: 2, questionIndex: 0, mimeType: "audio/webm" }]);
    assert.equal(JSON.stringify(metadataOnly(answers)).includes("clip"), false);
    assert.equal(isCaptureActive("prep"), true);
    assert.equal(isCaptureActive("recording"), true);
    assert.equal(isCaptureActive("idle"), false);
    assert.match(RECORDING_LEAVE_WARNING, /Bản ghi sẽ mất/);
  });

  it("accepts webm and browser-produced mp3, and refuses a missing bucket", () => {
    assert.equal(normalizeAudioMime("audio/webm;codecs=opus"), "audio/webm");
    assert.equal(normalizeAudioMime(""), "audio/webm");
    assert.equal(extensionForMime("audio/mpeg"), "mp3");
    assert.equal(normalizeAudioMime("video/webm"), null);
    assert.equal(
      speakingObjectKey({
        candidateNumber: "VN102-849201",
        paperId: "fixture-full",
        part: 2,
        questionIndex: 0,
        mimeType: "audio/webm",
        id: "abc",
      }),
      "VN102-849201/fixture-full/part-2-q-0-abc.webm",
    );
    assert.equal(readSpeakingStorageConfig({}), null);
    assert.equal(
      readSpeakingStorageConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SPEAKING_STORAGE_BUCKET: "speaking-private",
      })?.bucket,
      "speaking-private",
    );
  });
});
