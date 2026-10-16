import { remarkNotice } from "@/lib/admin-submission-view";

export function oneQuery(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function RemarkNotice({ code, band }: { code?: string; band?: string }) {
  const notice = remarkNotice(code, band);
  if (!notice) return null;
  const error = notice.tone === "err";
  return (
    <p
      role="alert"
      data-testid="remark-notice"
      className={`rounded-xl border px-4 py-3 text-sm ${
        error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      {notice.text}
    </p>
  );
}
