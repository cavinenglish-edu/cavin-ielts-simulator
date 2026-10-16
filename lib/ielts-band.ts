/**
 * Published IELTS Academic Listening raw-score averages, out of 40.
 * Source: IDP / IELTS Australia, “IELTS Listening band scores”
 * https://ielts.com.au/australia/results/ielts-band-scores/listening-band-score
 * That table stops at raw 11–12 = band 4. Raw 0 is band 0.
 * Raw 1–10 is below the published table and keeps the same two-mark
 * half-band step as the 11–12 row, so a short paper can still convert.
 */
const LISTENING_BANDS: Array<[number, number, number]> = [
  [39, 40, 9],
  [37, 38, 8.5],
  [35, 36, 8],
  [32, 34, 7.5],
  [30, 31, 7],
  [26, 29, 6.5],
  [23, 25, 6],
  [18, 22, 5.5],
  [16, 17, 5],
  [13, 15, 4.5],
  [11, 12, 4],
  [9, 10, 3.5],
  [7, 8, 3],
  [5, 6, 2.5],
  [3, 4, 2],
  [1, 2, 1],
  [0, 0, 0],
];

/**
 * Published IELTS Academic Reading raw-score averages, out of 40.
 * This is not the Listening table: band 7.5 is 33–34, band 7 is 30–32, band 5 is 15–18.
 * Source: IDP, “IELTS Academic Reading — Raw Score Conversion”
 * https://ielts.idp.com/egypt/results/scores/reading
 * That table stops at raw 4–5 = band 2.5. Raw 0–3 steps down by half a band per mark.
 */
const READING_BANDS: Array<[number, number, number]> = [
  [39, 40, 9],
  [37, 38, 8.5],
  [35, 36, 8],
  [33, 34, 7.5],
  [30, 32, 7],
  [27, 29, 6.5],
  [23, 26, 6],
  [19, 22, 5.5],
  [15, 18, 5],
  [13, 14, 4.5],
  [10, 12, 4],
  [8, 9, 3.5],
  [6, 7, 3],
  [4, 5, 2.5],
  [3, 3, 2],
  [2, 2, 1.5],
  [1, 1, 1],
  [0, 0, 0],
];

export type ObjectiveBand = {
  band: number;
  /** Marks on the published 40-question scale. */
  raw: number;
  estimated: boolean;
};

function clampRaw(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(40, Math.max(0, Math.round(value)));
}

function bandFromTable(raw: number, table: Array<[number, number, number]>): number {
  const score = clampRaw(raw);
  for (const [min, max, band] of table) {
    if (score >= min && score <= max) return band;
  }
  return 0;
}

/** A 40-question paper uses this table directly. */
export function listeningBandFromRaw(raw: number): number {
  return bandFromTable(raw, LISTENING_BANDS);
}

/** A 40-question Academic Reading paper uses this table directly. */
export function readingBandFromRaw(raw: number): number {
  return bandFromTable(raw, READING_BANDS);
}

/** correct/total scaled to 40, then rounded to the nearest integer. */
export function scaleRawToForty(correct: number, total: number): number {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0 || correct <= 0) return 0;
  const safeCorrect = Math.min(total, Math.max(0, correct));
  if (total === 40) return clampRaw(safeCorrect);
  return clampRaw((safeCorrect / total) * 40);
}

export function objectiveBand(skill: "listening" | "reading", correct: number, total: number): ObjectiveBand {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeCorrect = Number.isFinite(correct) ? Math.min(Math.max(0, correct), safeTotal || 0) : 0;
  const estimated = safeTotal !== 40;
  const raw = safeTotal === 40 ? clampRaw(safeCorrect) : scaleRawToForty(safeCorrect, safeTotal);
  const band = skill === "listening" ? listeningBandFromRaw(raw) : readingBandFromRaw(raw);
  return { band, raw, estimated };
}
