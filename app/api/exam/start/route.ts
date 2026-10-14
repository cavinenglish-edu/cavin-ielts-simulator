import { NextResponse } from "next/server";
import { z } from "zod";
import { isRetiredSpeakingSet } from "@/lib/exam-catalog";
import { beginListening, SECTION_PATH } from "@/lib/exam-sitting";
import { loadFullPaper } from "@/lib/full-paper";
import { publicSession, readSession, writeSession } from "@/lib/sitting-cookie";

const bodySchema = z.object({
  paperId: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Hãy nhập mã PIN trước." }, { status: 401 });
  if (session.section !== "pretest") {
    return NextResponse.json({ error: "Phiên thi đã bắt đầu." }, { status: 409 });
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  const paperId = parsed.success ? parsed.data.paperId || session.paperId : session.paperId;
  if (!paperId || isRetiredSpeakingSet(paperId)) {
    return NextResponse.json({ error: "Chọn một đề đã xuất bản trước khi bắt đầu." }, { status: 400 });
  }

  const paper = await loadFullPaper(paperId);
  if (!paper) {
    return NextResponse.json(
      { error: "Đề này không đủ Nghe, Đọc và Viết trong cùng một đề, hoặc chưa đủ đề thật để luyện trộn." },
      { status: 404 },
    );
  }

  const next = beginListening({ ...session, paperId: paper.id }, paper.listeningSeconds, Date.now());
  await writeSession(next);
  return NextResponse.json({ session: publicSession(next), next: SECTION_PATH.listening });
}
