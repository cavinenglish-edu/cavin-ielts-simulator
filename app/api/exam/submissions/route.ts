import { connection, NextResponse } from "next/server";
import { MISSING_AI_KEY, MARKING_FAILED, NO_TRANSCRIPT } from "@/lib/exam-marking";
import { listSubmissions, type MarkingStatus } from "@/lib/exam-submissions";
import { readSession } from "@/lib/sitting-cookie";

function noteFor(status: MarkingStatus): string {
  if (status === "pending_key") return MISSING_AI_KEY;
  if (status === "no_transcript") return NO_TRANSCRIPT;
  if (status === "marking_failed") return MARKING_FAILED;
  return "";
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
  return NextResponse.json({
    submissions: rows.map((row) => {
      const score = row.score && !Array.isArray(row.score) ? (row.score as Record<string, unknown>) : null;
      const correct = typeof score?.correct === "number" ? score.correct : undefined;
      const total = typeof score?.total === "number" ? score.total : undefined;
      const overall = typeof score?.overall === "number" ? score.overall : undefined;
      return {
        skill: row.skill,
        sent: true,
        headline: "Bài đã được gửi.",
        note: noteFor(row.marking_status),
        correct,
        total,
        overall,
      };
    }),
  });
}
