import { NextResponse } from "next/server";
import { saveSubmission } from "@/lib/exam-submissions";
import { fixtureFullPaper } from "@/lib/exam-fixture";
import { beginListening, FIXTURE_PAPER_ID, pretestSession } from "@/lib/exam-sitting";
import { publicSession, writeSession } from "@/lib/sitting-cookie";

export async function POST(request: Request) {
  if (process.env.E2E_FIXTURE !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body: unknown = await request.json().catch(() => null);
  const requested = body && typeof body === "object" && "phase" in body ? body.phase : "listening";
  const phase = requested === "pretest" || requested === "speaking" || requested === "done" ? requested : "listening";
  const paper = fixtureFullPaper();
  const now = Date.now();
  const base = pretestSession(
    {
      name: "NGUYEN VAN A",
      engName: "",
      phone: "",
      userType: "student",
      candidateNumber: "VN102-849201",
    },
    now,
  );
  if (phase === "done") {
    const done = { ...base, paperId: FIXTURE_PAPER_ID, section: "done" as const, accessGranted: true, durationSeconds: 0 };
    await writeSession(done);
    await seedReceipt(now);
    return NextResponse.json({ session: publicSession(done) });
  }
  const session =
    phase === "pretest"
      ? { ...base, paperId: FIXTURE_PAPER_ID, accessGranted: false }
      : phase === "speaking"
        ? { ...base, paperId: FIXTURE_PAPER_ID, section: "speaking" as const, accessGranted: true, durationSeconds: 0 }
        : beginListening({ ...base, paperId: FIXTURE_PAPER_ID, accessGranted: true }, paper.listeningSeconds, now);
  await writeSession(session);
  return NextResponse.json({ session: publicSession(session) });
}

async function seedReceipt(now: number) {
  const identity = {
    paper_id: FIXTURE_PAPER_ID,
    candidate_number: "VN102-849201",
    candidate_name: "NGUYEN VAN A",
    phone: "",
  };
  await saveSubmission({
    ...identity,
    skill: "listening",
    section_started_at: now,
    payload: { answers: {} },
    marking_status: "scored",
    score: {
      correct: 30,
      total: 40,
      band: 7,
      estimated: false,
      scaledRaw: 30,
      items: [{ id: "l1", prompt: "What is her name?", given: "Anna", expected: "Anna", ok: true }],
    },
  });
  await saveSubmission({
    ...identity,
    skill: "reading",
    section_started_at: now,
    payload: { answers: {} },
    marking_status: "scored",
    score: {
      correct: 32,
      total: 40,
      band: 7,
      estimated: false,
      scaledRaw: 32,
      items: [{ id: "r1", prompt: "Side", given: "north", expected: "north", ok: true }],
    },
  });
  await saveSubmission({
    ...identity,
    skill: "writing",
    section_started_at: now,
    payload: {},
    marking_status: "marked",
    score: { status: "marked", overall: 6.5, chart: "unseen" },
  });
  await saveSubmission({
    ...identity,
    skill: "speaking",
    section_started_at: now,
    payload: { recordings: [] },
    marking_status: "marked",
    score: { status: "marked", overall: 6.5 },
  });
  await saveSubmission({
    ...identity,
    skill: "writing",
    section_started_at: now - 1000,
    payload: {
      task1: {
        prompt: "The chart shows boat traffic.",
        imageUrl: "https://cdn.example/chart.png",
        essay: "The harbour was busier in the morning.",
      },
      task2: {
        prompt: "Discuss both views.",
        essay: "Cities should keep a working harbour.",
      },
    },
    score: null,
    marking_status: "marking_failed",
  });
  await saveSubmission({
    ...identity,
    skill: "speaking",
    section_started_at: now - 1000,
    payload: {
      recordings: [{ part: 1, questionIndex: 0, path: "VN102-849201/fixture-full/part-1-q-0-clip1.webm", transcript: "" }],
    },
    score: null,
    marking_status: "no_audio",
  });
}
