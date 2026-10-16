import { NextResponse } from "next/server";
import { NO_AUDIO } from "@/lib/exam-marking";

export async function POST() {
  return NextResponse.json({ ok: false, marking: "no_audio", message: NO_AUDIO });
}
