import { NextResponse } from "next/server";
import { MARKING_FAILED, MISSING_AI_KEY, NO_TRANSCRIPT, markSpeakingTranscript, readModelKey } from "@/lib/exam-marking";

function transcriptsFrom(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const answers = (body as { answers?: unknown }).answers;
  if (!Array.isArray(answers)) return "";
  return answers
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const transcript = (item as { transcript?: unknown }).transcript;
      return typeof transcript === "string" ? transcript.trim() : "";
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const transcript = transcriptsFrom(body);
    const key = readModelKey(process.env);
    if (!key) {
      return NextResponse.json({ ok: false, marking: "pending_key", message: MISSING_AI_KEY });
    }
    if (!transcript) {
      return NextResponse.json({ ok: false, marking: "no_transcript", message: NO_TRANSCRIPT });
    }
    const marked = await markSpeakingTranscript(transcript, key);
    if (!marked) {
      return NextResponse.json({ ok: false, marking: "marking_failed", message: MARKING_FAILED });
    }
    const byKey = Object.fromEntries(marked.criteria.map((item) => [item.key, item]));
    return NextResponse.json({
      ok: true,
      overall: marked.overall,
      criteria: {
        fc: { score: byKey.fluencyCoherence?.score ?? 0, title: "Fluency and Coherence", comments: byKey.fluencyCoherence?.comment ?? "" },
        lr: { score: byKey.lexicalResource?.score ?? 0, title: "Lexical Resource", comments: byKey.lexicalResource?.comment ?? "" },
        gra: { score: byKey.grammaticalRangeAccuracy?.score ?? 0, title: "Grammatical Range and Accuracy", comments: byKey.grammaticalRangeAccuracy?.comment ?? "" },
        p: { score: byKey.pronunciation?.score ?? 0, title: "Pronunciation", comments: byKey.pronunciation?.comment ?? "" },
      },
      detailedFeedback: [],
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Không chấm được bài." }, { status: 500 });
  }
}
