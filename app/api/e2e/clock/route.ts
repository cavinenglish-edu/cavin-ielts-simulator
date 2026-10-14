import { NextResponse } from "next/server";
import { shiftClock } from "@/lib/exam-sitting";
import { publicSession, readSession, writeSession } from "@/lib/sitting-cookie";

export async function POST(request: Request) {
  if (process.env.E2E_FIXTURE !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Chưa có phiên thi." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const addMs = body && typeof body === "object" && "addMs" in body ? Number(body.addMs) : NaN;
  const next = shiftClock(session, addMs, Date.now());
  if (!next || next.section !== session.section || next.listeningPhase !== session.listeningPhase) {
    return NextResponse.json({ error: "Không chỉnh được đồng hồ." }, { status: 400 });
  }
  await writeSession(next);
  return NextResponse.json({ session: publicSession(next) });
}
