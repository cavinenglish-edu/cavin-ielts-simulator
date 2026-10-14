import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseSkill, type Skill } from "@/lib/exam-skill";
import { fromDbRow, toDbRow, type PaperInput } from "@/lib/ielts-paper";

export type ExamListItem = {
  id: string;
  title: string;
  status: "draft" | "published";
  skill: Skill;
};

export function missingSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readableError(error: { message?: string } | null): string {
  const message = error?.message || "Supabase không trả về dữ liệu.";
  if (/skill|paper|schema cache|column/i.test(message)) {
    return `Supabase chưa có cột skill hoặc paper. Chạy scripts/supabase_skill_migration.sql trên SQL Editor. (${message})`;
  }
  return message;
}

export async function listExams(): Promise<{ ok: true; items: ExamListItem[] } | { ok: false; message: string }> {
  const supabase = adminClient();
  if (!supabase) {
    return { ok: false, message: `Chưa cấu hình Supabase (${missingSupabaseEnv().join(", ")}).` };
  }
  const { data, error } = await supabase
    .from("ielts_exams")
    .select("id, title, status, skill")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: readableError(error) };
  const items = (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Đề thi"),
    status: row.status === "draft" ? "draft" as const : "published" as const,
    skill: parseSkill(row.skill),
  }));
  return { ok: true, items };
}

export async function getExam(id: string): Promise<{ ok: true; paper: PaperInput } | { ok: false; message: string }> {
  const supabase = adminClient();
  if (!supabase) {
    return { ok: false, message: `Chưa cấu hình Supabase (${missingSupabaseEnv().join(", ")}).` };
  }
  const { data, error } = await supabase.from("ielts_exams").select("*").eq("id", id).maybeSingle();
  if (error) return { ok: false, message: readableError(error) };
  if (!data) return { ok: false, message: "Không tìm thấy đề thi." };
  try {
    return { ok: true, paper: fromDbRow(data as Record<string, unknown>) };
  } catch {
    return { ok: false, message: "Đề này không đúng cấu trúc bốn kỹ năng. Không mở được form sửa." };
  }
}

export async function saveExam(input: PaperInput): Promise<{ id: string; title: string; status: "draft" | "published" }> {
  const supabase = adminClient();
  if (!supabase) {
    throw new Error(`Chưa cấu hình Supabase (${missingSupabaseEnv().join(", ")}).`);
  }
  const payload = {
    ...toDbRow(input),
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("ielts_exams")
      .update(payload)
      .eq("id", input.id)
      .select("id, title, status")
      .maybeSingle();
    if (error) throw new Error(readableError(error));
    if (!data) throw new Error("Không tìm thấy đề để cập nhật.");
    return {
      id: String(data.id),
      title: String(data.title),
      status: data.status === "draft" ? "draft" : "published",
    };
  }
  const { data, error } = await supabase.from("ielts_exams").insert(payload).select("id, title, status").single();
  if (error) throw new Error(readableError(error));
  return {
    id: String(data.id),
    title: String(data.title),
    status: data.status === "draft" ? "draft" : "published",
  };
}
