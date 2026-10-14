import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { READING_SECONDS } from "./exam-skill";
import {
  advanceSitting,
  beginListening,
  beginReview,
  guardRedirect,
  pretestSession,
  remainingSeconds,
  shiftClock,
} from "./exam-sitting";
import { signSession, verifyExamSession } from "./exam-session-token";

const secret = "test-secret";

describe("sitting clock", () => {
  it("derives remaining time from a start timestamp and duration", () => {
    const started = 1_000_000;
    assert.equal(remainingSeconds(started, 3600, started + 30 * 60 * 1000), 1800);
    assert.equal(remainingSeconds(started, 3600, started + 3600 * 1000), 0);
    assert.equal(remainingSeconds(started, 3600, started - 5000), 3600);
  });

  it("does not add time when the offset is negative or zero", () => {
    const session = beginListening(pretestSession({ name: "A", candidateNumber: "VN102-1" }, 5_000), 120, 5_000);
    assert.equal(shiftClock(session, 0, 5_000), null);
    assert.equal(shiftClock(session, -60_000, 5_000), null);
    const shifted = shiftClock(session, 30_000, 5_000);
    assert.ok(shifted);
    assert.equal(remainingSeconds(shifted.sectionStartedAt, shifted.durationSeconds, 5_000 + shifted.clockOffsetMs), 90);
  });
});

describe("section guard", () => {
  const now = 10_000;
  const reading = {
    ...beginListening(pretestSession({ name: "A", candidateNumber: "VN102-1" }, now), 30, now),
    section: "reading" as const,
    durationSeconds: READING_SECONDS,
  };

  it("sends a missing session back to the library", () => {
    assert.equal(guardRedirect(null, "/exam/writing"), "/exam");
    assert.equal(guardRedirect(null, "/exam/reading"), "/exam");
    assert.equal(guardRedirect(null, "/exam/listening"), "/exam");
  });

  it("sends a direct writing hit back to the section in progress", () => {
    assert.equal(guardRedirect(reading, "/exam/writing"), "/exam/reading");
    assert.equal(guardRedirect(reading, "/exam/listening"), "/exam/reading");
    assert.equal(guardRedirect(reading, "/exam/reading"), null);
  });

  it("leaves the speaking room alone", () => {
    assert.equal(guardRedirect(reading, "/exam/room"), null);
  });
});

describe("advance order", () => {
  const now = 50_000;

  it("refuses to skip from listening audio straight to reading", () => {
    const listening = beginListening(pretestSession({ name: "A", candidateNumber: "VN102-1" }, now), 1800, now);
    const jumped = advanceSitting(listening, now + 5_000);
    assert.equal(jumped.ok, false);
    if (jumped.ok) return;
    assert.equal(jumped.reason, "wrong-phase");
  });

  it("moves review to reading only when the 2:00 clock is finished", () => {
    const listening = beginListening(pretestSession({ name: "A", candidateNumber: "VN102-1" }, now), 1800, now);
    const review = beginReview(listening, now + 1_000);
    assert.equal(review.ok, true);
    if (!review.ok) return;
    assert.equal(review.session.durationSeconds, 120);
    const early = advanceSitting(review.session, now + 1_000);
    assert.equal(early.ok, false);
    const done = advanceSitting(review.session, now + 1_000 + 120_000);
    assert.equal(done.ok, true);
    if (!done.ok) return;
    assert.equal(done.session.section, "reading");
    assert.equal(done.session.durationSeconds, READING_SECONDS);
    assert.equal(done.session.clockOffsetMs, 0);
  });

  it("signs the session so a edited payload does not verify", () => {
    const session = beginListening(pretestSession({ name: "A", candidateNumber: "VN102-1" }, now), 1800, now);
    const token = signSession(session, secret);
    assert.ok(verifyExamSession(token, secret, now + 1_000));
    const [body, signature] = token.split(".");
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { section: string };
    parsed.section = "writing";
    const forged = `${Buffer.from(JSON.stringify(parsed)).toString("base64url")}.${signature}`;
    assert.equal(verifyExamSession(forged, secret, now + 1_000), null);
  });
});
