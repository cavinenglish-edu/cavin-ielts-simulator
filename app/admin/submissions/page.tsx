import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { RemarkForm } from "@/app/admin/submissions/remark-button";
import { oneQuery, RemarkNotice } from "@/app/admin/submissions/notice";
import { loadAdminSubmissionList } from "@/lib/admin-submissions";
import type { AdminListItem } from "@/lib/admin-submission-view";

type Search = { remark?: string | string[]; band?: string | string[] };

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const params = await searchParams;
  const loaded = await loadAdminSubmissionList();
  if (!loaded.ok && loaded.reason === "auth") redirect("/admin");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Bài đã nộp</h1>
          <p className="mt-1 text-sm text-slate-600">Tên, số báo danh, đề, kỹ năng, thời gian và kết quả. Mở một dòng để xem bài.</p>
        </div>
        <form action="/admin/logout" method="post">
          <button type="submit" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
            Đăng xuất
          </button>
        </form>
      </div>
      <RemarkNotice code={oneQuery(params.remark)} band={oneQuery(params.band)} />
      {!loaded.ok ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loaded.message}
        </p>
      ) : (
        <SubmissionTable items={loaded.data} />
      )}
    </div>
  );
}

function SubmissionTable({ items }: { items: AdminListItem[] }) {
  if (items.length === 0) {
    return (
      <p data-testid="submission-list" className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">
        Chưa có bài nộp.
      </p>
    );
  }
  return (
    <div data-testid="submission-list" className="space-y-3">
      <ul className="space-y-3 md:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/admin/submissions/${item.id}`} className="font-semibold text-slate-900 hover:text-blue-800">
                  {item.candidateName}
                </Link>
                <p className="mt-1 font-mono text-sm text-blue-800">{item.candidateNumber}</p>
              </div>
              <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{item.skillLabel}</span>
            </div>
            <p className="mt-3 text-sm text-slate-800">{item.paperTitle}</p>
            <p className="mt-1 text-sm text-slate-600">
              <time dateTime={item.timeIso}>{item.timeLabel}</time>
            </p>
            <p className="mt-2 font-semibold text-slate-900" data-testid={`submission-result-${item.id}`}>
              {item.resultLabel}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link href={`/admin/submissions/${item.id}`} className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                Xem
              </Link>
              {item.canRemark ? (
                <RemarkForm id={item.id} back="list" label={`Chấm lại bài ${item.skillLabel} của ${item.candidateName}`} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="min-w-[760px] w-full text-left text-sm">
        <caption className="sr-only">Danh sách bài thí sinh đã nộp</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3">Thí sinh</th>
            <th scope="col" className="px-4 py-3">Số báo danh</th>
            <th scope="col" className="px-4 py-3">Đề</th>
            <th scope="col" className="px-4 py-3">Kỹ năng</th>
            <th scope="col" className="px-4 py-3">Thời gian</th>
            <th scope="col" className="px-4 py-3">Kết quả</th>
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100 last:border-0 align-top">
              <td className="px-4 py-3 font-semibold text-slate-900">
                <Link href={`/admin/submissions/${item.id}`} className="hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                  {item.candidateName}
                </Link>
              </td>
              <td className="px-4 py-3 font-mono text-blue-800">{item.candidateNumber}</td>
              <td className="px-4 py-3 text-slate-800">{item.paperTitle}</td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{item.skillLabel}</span>
              </td>
              <td className="px-4 py-3 text-slate-700">
                <time dateTime={item.timeIso}>{item.timeLabel}</time>
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900" data-testid={`submission-result-${item.id}`}>
                {item.resultLabel}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/admin/submissions/${item.id}`} className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                    Xem
                  </Link>
                  {item.canRemark ? (
                    <RemarkForm id={item.id} back="list" label={`Chấm lại bài ${item.skillLabel} của ${item.candidateName}`} />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
