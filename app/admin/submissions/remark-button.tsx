"use client";

import { useFormStatus } from "react-dom";
import { remarkSubmissionAction } from "@/app/admin/submissions/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="remark-button"
      aria-label={label}
      aria-busy={pending}
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
    >
      {pending ? "Đang chấm lại…" : "Chấm lại"}
    </button>
  );
}

export function RemarkForm({ id, back, label }: { id: string; back: "list" | "detail"; label: string }) {
  return (
    <form action={remarkSubmissionAction} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <SubmitButton label={label} />
    </form>
  );
}
