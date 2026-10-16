import { connection, NextResponse } from "next/server";
import { readCatalog } from "@/lib/exam-catalog";
import { FIXTURE_FORECAST_ID } from "@/lib/exam-fixture";
import { buildReceipt, receiptKind, type ReceiptKind } from "@/lib/exam-receipt";
import { listSubmissions } from "@/lib/exam-submissions";
import { parseSkill } from "@/lib/exam-skill";
import { supabase } from "@/lib/supabase";
import { readSession } from "@/lib/sitting-cookie";

async function kindFor(paperId: string): Promise<ReceiptKind> {
  if (process.env.E2E_FIXTURE === "1") return receiptKind(paperId, paperId === FIXTURE_FORECAST_ID ? "forecast" : "actual");
  if (!supabase || !paperId) return receiptKind(paperId, null);
  const selected = await supabase.from("ielts_exams").select("skill, paper").eq("id", paperId).maybeSingle();
  if (selected.error || !selected.data) return receiptKind(paperId, null);
  const row = selected.data as { skill?: unknown; paper?: unknown };
  return receiptKind(paperId, readCatalog(row.paper, parseSkill(row.skill)));
}

export async function GET() {
  await connection();
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Hãy nhập mã PIN trước." }, { status: 401 });
  const rows = await listSubmissions({
    paperId: session.paperId,
    candidateNumber: session.candidateNumber,
    phone: session.phone,
  });
  const kind = await kindFor(session.paperId);
  return NextResponse.json(buildReceipt(kind, rows, session.section === "done"));
}
