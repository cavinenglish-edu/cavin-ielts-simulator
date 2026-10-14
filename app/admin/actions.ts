"use server";

import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/admin-cookie";
import { missingSupabaseEnv, saveExam } from "@/lib/exam-admin";
import { fieldErrorsFromZod, paperInputSchema, preparePaperInput } from "@/lib/ielts-paper";

export type SaveState = {
  ok: boolean;
  message?: string;
  configError?: string;
  fieldErrors?: Record<string, string[]>;
  examId?: string;
};

export async function saveExamAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, message: "Phiên quản trị đã hết hạn. Đăng nhập lại." };
  }

  const raw = formData.get("paper");
  if (typeof raw !== "string") {
    return { ok: false, message: "Thiếu dữ liệu đề thi." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Dữ liệu đề thi không hợp lệ." };
  }

  if (!parsedJson || typeof parsedJson !== "object") {
    return { ok: false, message: "Dữ liệu đề thi không hợp lệ." };
  }

  const status = formData.get("status") === "draft" ? "draft" : "published";
  const validated = paperInputSchema.safeParse(
    preparePaperInput({ ...(parsedJson as Record<string, unknown>), status }),
  );
  if (!validated.success) {
    return {
      ok: false,
      message: "Đề chưa hợp lệ. Kiểm tra các trường bắt buộc.",
      fieldErrors: fieldErrorsFromZod(validated.error),
    };
  }

  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    return {
      ok: false,
      configError: `Chưa cấu hình Supabase (${missing.join(", ")}). Đề chưa được lưu.`,
    };
  }

  try {
    const saved = await saveExam(validated.data);
    revalidatePath("/admin");
    revalidatePath("/exam");
    const verb = saved.status === "published" ? "Đã xuất bản" : "Đã lưu nháp";
    const tail =
      saved.status === "published"
        ? "Thư viện thí sinh sẽ thấy đề này."
        : "Thí sinh chưa thấy đề này.";
    return {
      ok: true,
      examId: saved.id,
      message: `${verb} «${saved.title}». ${tail}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được đề.";
    if (/skill|paper|schema cache|column|supabase_skill_migration/i.test(message)) {
      return { ok: false, configError: message };
    }
    return { ok: false, message: `Không lưu được đề: ${message}` };
  }
}
