import { NextResponse } from "next/server";
import { z } from "zod";
import { grantAccess } from "@/lib/exam-sitting";
import { loadFullPaper } from "@/lib/full-paper";
import { codesMatch } from "@/lib/exam-session-token";
import { publicSession, readSession, writeSession } from "@/lib/sitting-cookie";

const bodySchema = z.object({
  paperId: z.string().trim().min(1).max(80),
  code: z.string().trim().min(4).max(64),
});

const failures = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 8;

function limited(key: string, now: number): boolean {
  const kept = (failures.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  failures.set(key, kept);
  return kept.length >= LIMIT;
}

function noteFailure(key: string, now: number) {
  const kept = (failures.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  kept.push(now);
  failures.set(key, kept);
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Hãy nhập mã PIN trước." }, { status: 401 });
  if (session.section !== "pretest") {
    return NextResponse.json({ error: "Phiên thi đã bắt đầu." }, { status: 409 });
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Mã truy cập không hợp lệ." }, { status: 400 });
  }

  const now = Date.now();
  const key = `${session.candidateNumber}:${parsed.data.paperId}`;
  if (limited(key, now)) {
    return NextResponse.json({ error: "Thử mã quá nhiều lần. Đợi vài phút rồi thử lại." }, { status: 429 });
  }

  const paper = await loadFullPaper(parsed.data.paperId);
  if (!paper) return NextResponse.json({ error: "Không tìm thấy đề đã xuất bản." }, { status: 404 });
  if (!paper.accessCode) {
    return NextResponse.json({ error: "Đề này chưa có mã truy cập trên máy chủ." }, { status: 409 });
  }
  if (!codesMatch(parsed.data.code, paper.accessCode)) {
    noteFailure(key, now);
    return NextResponse.json({ error: "Mã truy cập không đúng." }, { status: 401 });
  }

  const granted = grantAccess(session, paper.id, now);
  await writeSession(granted);
  return NextResponse.json({ session: publicSession(granted), title: paper.title });
}
