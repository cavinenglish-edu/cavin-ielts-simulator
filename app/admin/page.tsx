import { Suspense } from "react";
import Link from "next/link";
import { ExamList } from "@/app/admin/exam-list";
import { LoginForm } from "@/app/admin/login-form";
import { PaperForm } from "@/app/admin/paper-form";
import { isAdminAuthenticated } from "@/lib/admin-cookie";
import { rosterCredentialStatus } from "@/lib/admin-roster";
import { getExam, listExams, missingSupabaseEnv, type ExamListItem } from "@/lib/exam-admin";
import type { PaperInput } from "@/lib/ielts-paper";

export const metadata = {
  title: "Quản trị đề thi | Cavin's English",
  robots: { index: false, follow: false },
};

export const instant = false;

type AdminSearch = { id?: string | string[]; error?: string | string[] };

export default function AdminPage({ searchParams }: { searchParams: Promise<AdminSearch> }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-extrabold tracking-tight">
              IELTS <span className="text-red-500">on Computer</span>
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded bg-slate-800 border border-slate-700">Quản trị đề</span>
          </div>
          <Link href="/exam" className="text-xs text-slate-300 hover:text-white">
            Thư viện thí sinh
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Suspense fallback={<AdminSkeleton />}>
          <AdminBody searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function AdminBody({ searchParams }: { searchParams: Promise<AdminSearch> }) {
  const params = await searchParams;
  const editId = typeof params.id === "string" ? params.id : undefined;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const passwordMissing = !process.env.ADMIN_PASSWORD;
  const supabaseMissing = missingSupabaseEnv();
  const rosterStatus = rosterCredentialStatus();

  if (passwordMissing) {
    return <ConfigAlert missing={["ADMIN_PASSWORD", ...supabaseMissing]} />;
  }

  const authed = await isAdminAuthenticated();
  if (!authed) {
    return (
      <div className="space-y-6">
        {supabaseMissing.length > 0 ? <ConfigAlert missing={supabaseMissing} /> : null}
        {rosterStatus !== "ok" && errorCode !== "sheet_config" && errorCode !== "sheet_invalid" ? (
          <RosterAlert status={rosterStatus} />
        ) : null}
        <LoginForm errorCode={errorCode} />
      </div>
    );
  }

  let items: ExamListItem[] = [];
  let listMessage: string | null = null;
  let initial: PaperInput | null = null;
  let loadMessage: string | null = null;

  if (supabaseMissing.length === 0) {
    const listed = await listExams();
    if (listed.ok) items = listed.items;
    else listMessage = listed.message;
    if (editId) {
      const loaded = await getExam(editId);
      if (loaded.ok) initial = loaded.paper;
      else loadMessage = loaded.message;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-600">Ra đề Nghe, Đọc, Viết, Nói rồi xuất bản thẳng vào thư viện.</p>
        <form action="/admin/logout" method="post">
          <button type="submit" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
            Đăng xuất
          </button>
        </form>
      </div>
      {supabaseMissing.length > 0 ? <ConfigAlert missing={supabaseMissing} /> : null}
      {listMessage ? <ConfigAlert message={listMessage} /> : null}
      {loadMessage ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadMessage}
        </p>
      ) : null}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <PaperForm key={initial?.id ?? "new"} initial={initial} />
        </div>
        <ExamList items={items} activeId={editId} unconfigured={supabaseMissing.length > 0 || Boolean(listMessage)} />
      </div>
    </div>
  );
}

function RosterAlert({ status }: { status: "missing_credential" | "invalid_credential" }) {
  const message =
    status === "missing_credential"
      ? "Máy chủ chưa có tài khoản Google để đọc danh sách quản trị. Thêm GOOGLE_SERVICE_ACCOUNT_JSON, rồi chia sẻ sheet «Thông tin chung của Admin» cho email của tài khoản dịch vụ với quyền Viewer. Không công khai sheet."
      : "Khóa tài khoản dịch vụ không hợp lệ. GOOGLE_SERVICE_ACCOUNT_JSON cần client_email và private_key.";
  return (
    <div role="alert" data-testid="roster-banner" className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
      <p className="font-bold">Chưa đọc được danh sách quản trị</p>
      <p className="mt-2">{message}</p>
    </div>
  );
}

function ConfigAlert({ missing, message }: { missing?: string[]; message?: string }) {
  return (
    <div role="alert" data-testid="config-banner" className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
      <p className="font-bold">Chưa cấu hình để lưu đề</p>
      {message ? <p className="mt-2">{message}</p> : null}
      {missing && missing.length > 0 ? (
        <ul className="mt-2 list-disc pl-5">
          {missing.map((name) => (
            <li key={name}>
              Thiếu biến môi trường <code className="font-mono">{name}</code>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2">Trang không ghi đề giả. Điền form vẫn được; bấm lưu sẽ báo lỗi cấu hình nếu Supabase chưa sẵn sàng.</p>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang mở trang quản trị" className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 h-96 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
    </div>
  );
}
