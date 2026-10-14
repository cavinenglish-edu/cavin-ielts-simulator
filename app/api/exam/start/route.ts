import { NextResponse } from "next/server";
import { beginListening, SECTION_PATH } from "@/lib/exam-sitting";
import { loadFullPaper } from "@/lib/full-paper";
import { publicSession, readSession, writeSession } from "@/lib/sitting-cookie";

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Hãy nhập mã PIN trước." }, { status: 401 });
  if (session.section !== "pretest" || !session.accessGranted || !session.paperId) {
    return NextResponse.json({ error: "Cần mã truy cập đúng trước khi vào phòng thi." }, { status: 403 });
  }
  const paper = await loadFullPaper(session.paperId);
  if (!paper) return NextResponse.json({ error: "Không tìm thấy đề đã xuất bản." }, { status: 404 });
  const next = beginListening(session, paper.listeningSeconds, Date.now());
  await writeSession(next);
  return NextResponse.json({ session: publicSession(next), next: SECTION_PATH.listening });
}
