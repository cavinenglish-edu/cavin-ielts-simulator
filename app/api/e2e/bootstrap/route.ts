import { NextResponse } from "next/server";
import { fixtureFullPaper } from "@/lib/exam-fixture";
import { beginListening, FIXTURE_PAPER_ID, pretestSession } from "@/lib/exam-sitting";
import { publicSession, writeSession } from "@/lib/sitting-cookie";

export async function POST(request: Request) {
  if (process.env.E2E_FIXTURE !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body: unknown = await request.json().catch(() => null);
  const phase = body && typeof body === "object" && "phase" in body && body.phase === "pretest" ? "pretest" : "listening";
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
  const session =
    phase === "pretest"
      ? { ...base, paperId: FIXTURE_PAPER_ID, accessGranted: false }
      : beginListening({ ...base, paperId: FIXTURE_PAPER_ID, accessGranted: true }, paper.listeningSeconds, now);
  await writeSession(session);
  return NextResponse.json({ session: publicSession(session) });
}
