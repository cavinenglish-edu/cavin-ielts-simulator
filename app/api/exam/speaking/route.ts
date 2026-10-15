import { NextResponse } from "next/server";
import { isRetiredSpeakingSet, PRACTICE_MIX_ID, readCatalog } from "@/lib/exam-catalog";
import { FIXTURE_ACTUAL_ID, FIXTURE_FORECAST_ID, fixtureSpeaking } from "@/lib/exam-fixture";
import { FIXTURE_PAPER_ID } from "@/lib/exam-sitting";
import { parseSkill } from "@/lib/exam-skill";
import { speakingExamFromRow } from "@/lib/speaking-script";
import { supabase } from "@/lib/supabase";
import { readSession, writeSession } from "@/lib/sitting-cookie";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Hãy nhập mã PIN trước." }, { status: 401 });

  const requested = new URL(request.url).searchParams.get("id")?.trim() || "";
  const paperId = requested || session.paperId;
  if (!paperId || paperId === PRACTICE_MIX_ID || isRetiredSpeakingSet(paperId)) {
    return NextResponse.json({ error: "Bài luyện trộn không có phần Nói." }, { status: 404 });
  }
  if (session.paperId && session.paperId !== paperId) {
    return NextResponse.json({ error: "Phiên thi đang gắn với một đề khác." }, { status: 409 });
  }

  const candidate = { candidateName: session.name, candidateNumber: session.candidateNumber };

  const bind = async () => {
    if (session.paperId !== paperId) await writeSession({ ...session, paperId });
  };

  if (process.env.E2E_FIXTURE === "1" && (paperId === FIXTURE_PAPER_ID || paperId === FIXTURE_ACTUAL_ID)) {
    if (session.section !== "speaking") {
      return NextResponse.json({ error: "Hãy hoàn thành Nghe, Đọc và Viết trước phần Nói." }, { status: 409 });
    }
    await bind();
    return NextResponse.json({ paper: { ...fixtureSpeaking("actual"), id: paperId }, ...candidate });
  }

  if (process.env.E2E_FIXTURE === "1" && paperId === FIXTURE_FORECAST_ID) {
    await bind();
    return NextResponse.json({ paper: fixtureSpeaking("forecast"), ...candidate });
  }

  if (!supabase) return NextResponse.json({ error: "Không tìm thấy phần Nói." }, { status: 404 });

  const selected = await supabase.from("ielts_exams").select("*").eq("id", paperId).eq("status", "published").maybeSingle();
  if (selected.error || !selected.data) {
    return NextResponse.json({ error: "Không tìm thấy phần Nói." }, { status: 404 });
  }
  const row = selected.data as Record<string, unknown>;
  const paper = speakingExamFromRow(row);
  if (!paper) return NextResponse.json({ error: "Đề này không có câu hỏi Nói." }, { status: 404 });
  const catalog = readCatalog(row.paper, parseSkill(row.skill));
  if (catalog !== "forecast" && session.section !== "speaking") {
    return NextResponse.json({ error: "Hãy hoàn thành Nghe, Đọc và Viết trước phần Nói của đề thật." }, { status: 409 });
  }
  await bind();
  return NextResponse.json({ paper, ...candidate });
}
