import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listeningBandFromRaw, objectiveBand, readingBandFromRaw, scaleRawToForty } from "./ielts-band";

describe("published academic raw-to-band tables", () => {
  it("converts a 40-question Listening raw score on the IDP table", () => {
    assert.equal(listeningBandFromRaw(40), 9);
    assert.equal(listeningBandFromRaw(39), 9);
    assert.equal(listeningBandFromRaw(37), 8.5);
    assert.equal(listeningBandFromRaw(35), 8);
    assert.equal(listeningBandFromRaw(32), 7.5);
    assert.equal(listeningBandFromRaw(30), 7);
    assert.equal(listeningBandFromRaw(31), 7);
    assert.equal(listeningBandFromRaw(26), 6.5);
    assert.equal(listeningBandFromRaw(23), 6);
    assert.equal(listeningBandFromRaw(18), 5.5);
    assert.equal(listeningBandFromRaw(16), 5);
    assert.equal(listeningBandFromRaw(13), 4.5);
    assert.equal(listeningBandFromRaw(11), 4);
    assert.equal(listeningBandFromRaw(0), 0);
  });

  it("uses a different Academic Reading table", () => {
    assert.equal(readingBandFromRaw(32), 7);
    assert.equal(listeningBandFromRaw(32), 7.5);
    assert.equal(readingBandFromRaw(33), 7.5);
    assert.equal(readingBandFromRaw(30), 7);
    assert.equal(readingBandFromRaw(23), 6);
    assert.equal(readingBandFromRaw(15), 5);
    assert.equal(listeningBandFromRaw(15), 4.5);
    assert.equal(readingBandFromRaw(4), 2.5);
    assert.equal(readingBandFromRaw(39), 9);
  });

  it("uses a 40-question paper directly and labels a shorter paper as estimated", () => {
    const full = objectiveBand("listening", 30, 40);
    assert.deepEqual(full, { band: 7, raw: 30, estimated: false });

    const half = objectiveBand("listening", 15, 20);
    assert.equal(half.raw, 30);
    assert.equal(half.band, 7);
    assert.equal(half.estimated, true);

    assert.equal(scaleRawToForty(1, 3), 13);
    assert.equal(objectiveBand("listening", 1, 3).band, 4.5);
    assert.equal(scaleRawToForty(29, 80), 15);
    assert.equal(objectiveBand("reading", 29, 80).band, 5);
    assert.equal(objectiveBand("reading", 0, 10).band, 0);
  });
});
