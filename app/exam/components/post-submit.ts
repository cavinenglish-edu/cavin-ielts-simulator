import type { SubmitView } from "@/lib/exam-submit";

export async function postSubmit(body: Record<string, unknown>): Promise<SubmitView> {
  try {
    const response = await fetch("/api/exam/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as SubmitView | null;
    if (!data || typeof data.message !== "string") return { ok: false, message: "Không gửi được bài." };
    return data;
  } catch {
    return { ok: false, message: "Không gửi được bài." };
  }
}
