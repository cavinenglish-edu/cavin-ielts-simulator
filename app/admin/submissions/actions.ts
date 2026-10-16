"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-cookie";
import { remarkStoredSubmission } from "@/lib/admin-submissions";

const remarkRequest = z.object({
  id: z.string().uuid(),
  back: z.enum(["list", "detail"]),
});

export async function remarkSubmissionAction(formData: FormData): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  const parsed = remarkRequest.safeParse({
    id: formData.get("id"),
    back: formData.get("back"),
  });
  if (!parsed.success) redirect("/admin/submissions?remark=denied");

  const result = await remarkStoredSubmission(parsed.data.id);
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${parsed.data.id}`);
  const params = new URLSearchParams({ remark: result.code });
  if (result.code === "marked" && typeof result.band === "number") params.set("band", result.band.toFixed(1));
  const path = parsed.data.back === "list" ? "/admin/submissions" : `/admin/submissions/${parsed.data.id}`;
  redirect(`${path}?${params.toString()}`);
}
