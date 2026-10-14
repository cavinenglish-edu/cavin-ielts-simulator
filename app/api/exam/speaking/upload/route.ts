import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRetiredSpeakingSet, PRACTICE_MIX_ID, readCatalog } from "@/lib/exam-catalog";
import { FIXTURE_ACTUAL_ID, FIXTURE_FORECAST_ID } from "@/lib/exam-fixture";
import { FIXTURE_PAPER_ID } from "@/lib/exam-sitting";
import { parseSkill } from "@/lib/exam-skill";
import {
  normalizeAudioMime,
  readSpeakingStorageConfig,
  SPEAKING_STORAGE_MISSING,
  speakingObjectKey,
  type SpeakingPart,
} from "@/lib/speaking-recording";
import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import { readSession } from "@/lib/sitting-cookie";

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_CLIPS = 30;

function partOf(value: FormDataEntryValue | undefined): SpeakingPart | null {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2 || parsed === 3) return parsed;
  return null;
}

async function allowed(sessionPaperId: string, section: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!sessionPaperId || sessionPaperId === PRACTICE_MIX_ID || isRetiredSpeakingSet(sessionPaperId)) {
    return { ok: false, status: 400, error: "Phiên thi này không có phần Nói để lưu." };
  }
  if (process.env.E2E_FIXTURE === "1") {
    if (sessionPaperId === FIXTURE_FORECAST_ID) return { ok: true };
    if ((sessionPaperId === FIXTURE_PAPER_ID || sessionPaperId === FIXTURE_ACTUAL_ID) && section === "speaking") return { ok: true };
    return { ok: false, status: 409, error: "Hãy hoàn thành Nghe, Đọc và Viết trước khi lưu phần Nói." };
  }
  if (!supabase) return { ok: false, status: 404, error: "Không tìm thấy đề để lưu phần Nói." };
  const selected = await supabase.from("ielts_exams").select("id, skill, paper, title").eq("id", sessionPaperId).eq("status", "published").maybeSingle();
  if (selected.error || !selected.data) return { ok: false, status: 404, error: "Không tìm thấy đề để lưu phần Nói." };
  const row = selected.data as Record<string, unknown>;
  if (isRetiredSpeakingSet(sessionPaperId, typeof row.title === "string" ? row.title : "")) {
    return { ok: false, status: 400, error: "Phiên thi này không có phần Nói để lưu." };
  }
  const catalog = readCatalog(row.paper, parseSkill(row.skill));
  if (catalog !== "forecast" && section !== "speaking") {
    return { ok: false, status: 409, error: "Hãy hoàn thành Nghe, Đọc và Viết trước khi lưu phần Nói." };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  await connection();
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Hãy nhập mã PIN trước." }, { status: 401 });

  const gate = await allowed(session.paperId, session.section);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const storage = readSpeakingStorageConfig(process.env);
  if (!storage) return NextResponse.json({ error: SPEAKING_STORAGE_MISSING }, { status: 503 });

  const form = await request.formData();
  const files = form.getAll("audio");
  const parts = form.getAll("part");
  const indexes = form.getAll("questionIndex");
  const mimes = form.getAll("mimeType");
  if (files.length === 0 || files.length !== parts.length || files.length !== indexes.length) {
    return NextResponse.json({ error: "Không có bản ghi để lưu." }, { status: 400 });
  }
  if (files.length > MAX_CLIPS) return NextResponse.json({ error: "Quá nhiều đoạn ghi." }, { status: 400 });

  const client = createClient(storage.url, storage.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const stored: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!(file instanceof File)) return NextResponse.json({ error: "Bản ghi không đúng định dạng." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Một đoạn ghi trống hoặc quá lớn." }, { status: 400 });
    }
    const part = partOf(parts[index]);
    const questionIndex = Number(indexes[index]);
    if (!part || !Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 19) {
      return NextResponse.json({ error: "Thiếu phần hoặc số câu của bản ghi." }, { status: 400 });
    }
    const declared = typeof mimes[index] === "string" ? mimes[index] : file.type;
    const mime = normalizeAudioMime(String(declared || file.type || ""));
    if (!mime) return NextResponse.json({ error: "Chỉ lưu được webm, hoặc mp3 nếu trình duyệt đã ghi ra mp3." }, { status: 400 });
    const key = speakingObjectKey({
      candidateNumber: session.candidateNumber,
      paperId: session.paperId,
      part,
      questionIndex,
      mimeType: mime,
      id: randomUUID(),
    });
    if (!key) return NextResponse.json({ error: "Không đặt được tên file ghi âm." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await client.storage.from(storage.bucket).upload(key, bytes, { contentType: mime, upsert: false });
    if (uploaded.error) {
      console.error("Speaking upload failed");
      return NextResponse.json({ error: "Không lưu được bản ghi vào kho." }, { status: 502 });
    }
    stored.push(key);
  }

  return NextResponse.json({ ok: true, stored: stored.length });
}
