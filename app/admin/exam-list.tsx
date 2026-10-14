import Link from "next/link";
import { SKILL_LABEL, type Skill } from "@/lib/exam-skill";
import type { ExamListItem } from "@/lib/exam-admin";

export function ExamList({
  items,
  activeId,
  unconfigured,
}: {
  items: ExamListItem[];
  activeId?: string;
  unconfigured: boolean;
}) {
  return (
    <aside className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <h2 className="text-sm font-bold text-slate-900 px-2">Đề đã có</h2>
      <p className="text-xs text-slate-600 px-2 mt-1 mb-4">Tiêu đề, kỹ năng và trạng thái. Bấm một dòng để sửa.</p>
      {unconfigured ? (
        <p className="text-sm text-slate-600 px-2">Chưa tải danh sách vì thiếu cấu hình Supabase.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600 px-2">Chưa có đề nào trong Supabase.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin?id=${item.id}`}
                className={`block rounded-xl border px-3 py-3 hover:border-blue-300 ${
                  item.id === activeId ? "border-blue-500 bg-blue-50" : "border-slate-200"
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                <span className="mt-2 flex items-center gap-2 text-xs">
                  <SkillBadge skill={item.skill} />
                  <StatusBadge status={item.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function SkillBadge({ skill }: { skill: Skill }) {
  return <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">{SKILL_LABEL[skill]}</span>;
}

function StatusBadge({ status }: { status: ExamListItem["status"] }) {
  const published = status === "published";
  return (
    <span
      className={`px-2 py-1 rounded-lg font-semibold ${
        published ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
      }`}
    >
      {published ? "Đã xuất bản" : "Nháp"}
    </span>
  );
}
