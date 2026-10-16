import Link from "next/link";

export function AdminChrome({
  badge,
  current,
  children,
}: {
  badge: string;
  current: "papers" | "submissions";
  children: React.ReactNode;
}) {
  const link = (active: boolean) =>
    `hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
      active ? "font-semibold text-white" : "text-slate-300"
    }`;
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-extrabold tracking-tight">
              IELTS <span className="text-red-500">on Computer</span>
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded bg-slate-800 border border-slate-700">{badge}</span>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-xs">
            <Link href="/admin" className={link(current === "papers")}>
              Ra đề
            </Link>
            <Link href="/admin/submissions" className={link(current === "submissions")} data-testid="admin-submissions-link">
              Bài đã nộp
            </Link>
            <Link href="/exam" className="text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Thư viện thí sinh
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
