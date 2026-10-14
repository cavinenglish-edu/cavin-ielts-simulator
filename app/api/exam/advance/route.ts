import { NextResponse } from "next/server";
import { advanceSitting, SECTION_PATH } from "@/lib/exam-sitting";
import { publicSession, readSession, writeSession } from "@/lib/sitting-cookie";

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Chưa có phiên thi." }, { status: 401 });
  const next = advanceSitting(session, Date.now());
  if (!next.ok) return NextResponse.json({ error: next.reason }, { status: 409 });
  await writeSession(next.session);
  return NextResponse.json({
    session: publicSession(next.session),
    next: SECTION_PATH[next.session.section],
  });
}
