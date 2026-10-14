import { NextResponse } from "next/server";
import { beginReview } from "@/lib/exam-sitting";
import { publicSession, readSession, writeSession } from "@/lib/sitting-cookie";

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Chưa có phiên thi." }, { status: 401 });
  const review = beginReview(session, Date.now());
  if (!review.ok) return NextResponse.json({ error: "Audio chưa ở giai đoạn nghe." }, { status: 409 });
  await writeSession(review.session);
  return NextResponse.json({ session: publicSession(review.session) });
}
