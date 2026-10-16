import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Skill } from "@/lib/exam-skill";

export type MarkingStatus = "scored" | "marked" | "pending_key" | "no_transcript" | "no_audio" | "marking_failed" | "saved";

export type SubmissionRow = {
  paper_id: string;
  candidate_number: string;
  candidate_name: string;
  phone: string;
  skill: Skill;
  section_started_at: number;
  payload: object;
  score: object | null;
  marking_status: MarkingStatus;
};

export type StoredSubmission = SubmissionRow & { id?: string };

type MemoryGlobal = typeof globalThis & { __examSubmissions?: StoredSubmission[] };

function memory(): StoredSubmission[] {
  const holder = globalThis as MemoryGlobal;
  if (!holder.__examSubmissions) holder.__examSubmissions = [];
  return holder.__examSubmissions;
}

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function sameSitting(row: StoredSubmission, input: SubmissionRow): boolean {
  return (
    row.paper_id === input.paper_id &&
    row.candidate_number === input.candidate_number &&
    row.phone === input.phone &&
    row.skill === input.skill &&
    row.section_started_at === input.section_started_at
  );
}

export async function saveSubmission(input: SubmissionRow): Promise<{ ok: true } | { ok: false; message: string }> {
  if (process.env.E2E_FIXTURE === "1") {
    const rows = memory();
    const index = rows.findIndex((row) => sameSitting(row, input));
    if (index >= 0) rows[index] = input;
    else rows.push(input);
    return { ok: true };
  }
  const supabase = serviceClient();
  if (!supabase) return { ok: false, message: "Chưa lưu được bài vì chưa cấu hình Supabase." };
  const { error } = await supabase.from("exam_submissions").upsert(
    {
      ...input,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paper_id,candidate_number,phone,skill,section_started_at" },
  );
  if (error) {
    if (/exam_submissions|schema cache|relation/i.test(error.message)) {
      return { ok: false, message: "Chưa lưu được bài. Hãy chạy scripts/supabase_submissions_migration.sql trên Supabase." };
    }
    return { ok: false, message: "Chưa lưu được bài." };
  }
  return { ok: true };
}

export async function listSubmissions(identity: {
  paperId: string;
  candidateNumber: string;
  phone: string;
}): Promise<StoredSubmission[]> {
  if (process.env.E2E_FIXTURE === "1") {
    return memory().filter(
      (row) => row.paper_id === identity.paperId && row.candidate_number === identity.candidateNumber && row.phone === identity.phone,
    );
  }
  const supabase = serviceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("exam_submissions")
    .select("paper_id, candidate_number, candidate_name, phone, skill, section_started_at, payload, score, marking_status")
    .eq("paper_id", identity.paperId)
    .eq("candidate_number", identity.candidateNumber)
    .eq("phone", identity.phone);
  if (error || !data) return [];
  return data as StoredSubmission[];
}
