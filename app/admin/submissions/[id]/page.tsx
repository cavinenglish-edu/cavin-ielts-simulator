import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { RemarkForm } from "@/app/admin/submissions/remark-button";
import { oneQuery, RemarkNotice } from "@/app/admin/submissions/notice";
import { loadAdminSubmissionDetail } from "@/lib/admin-submissions";
import type { AdminDetail } from "@/lib/admin-submission-view";
import { isPublicChartUrl } from "@/lib/exam-marking";

type Search = { remark?: string | string[]; band?: string | string[] };

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  await connection();
  const { id } = await params;
  const query = await searchParams;
  const loaded = await loadAdminSubmissionDetail(id);
  if (!loaded.ok && loaded.reason === "auth") redirect("/admin");

  return (
    <div className="space-y-6" data-testid="submission-detail">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin/submissions" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
          ← Danh sách bài nộp
        </Link>
        <form action="/admin/logout" method="post">
          <button type="submit" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
            Đăng xuất
          </button>
        </form>
      </div>
      <RemarkNotice code={oneQuery(query.remark)} band={oneQuery(query.band)} />
      {!loaded.ok ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loaded.message}
        </p>
      ) : (
        <Detail detail={loaded.data} />
      )}
    </div>
  );
}

function Detail({ detail }: { detail: AdminDetail }) {
  return (
    <article className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{detail.skillLabel}</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">{detail.candidateName}</h1>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Số báo danh</dt>
            <dd className="font-mono font-bold text-blue-800">{detail.candidateNumber}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Đề</dt>
            <dd className="font-semibold text-slate-900">{detail.paperTitle}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Thời gian</dt>
            <dd>
              <time dateTime={detail.timeIso}>{detail.timeLabel}</time>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Kết quả</dt>
            <dd className="text-2xl font-black text-slate-900" data-testid="submission-result">
              {detail.resultLabel}
            </dd>
          </div>
        </dl>
        {detail.note ? <p className="mt-4 text-sm text-slate-700">{detail.note}</p> : null}
        {detail.chartNote ? <p className="mt-2 text-sm text-slate-700">{detail.chartNote}</p> : null}
        {detail.canRemark ? (
          <div className="mt-5">
            <RemarkForm id={detail.id} back="detail" label={`Chấm lại bài ${detail.skillLabel} của ${detail.candidateName}`} />
          </div>
        ) : detail.skill === "listening" || detail.skill === "reading" ? (
          <p className="mt-5 text-sm text-slate-600">Nghe và Đọc chấm bằng đáp án, không chấm lại bằng Gemini.</p>
        ) : null}
      </header>
      {detail.answers.length > 0 ? <Answers answers={detail.answers} /> : null}
      {detail.skill === "writing" ? (
        detail.essays.length > 0 ? (
          <Essays essays={detail.essays} />
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">Không có bài viết trong bài nộp.</p>
        )
      ) : null}
      {detail.skill === "writing" || detail.skill === "speaking" ? <Criteria criteria={detail.criteria} /> : null}
      {detail.skill === "speaking" ? <SpeakingAudio clips={detail.clips} /> : null}
    </article>
  );
}

function Answers({ answers }: { answers: AdminDetail["answers"] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-slate-900">Câu trả lời</h2>
      <ul className="mt-4 space-y-3">
        {answers.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
            <p className="font-semibold text-slate-900">{item.prompt}</p>
            <p className={item.ok === true ? "text-emerald-800" : item.ok === false ? "text-red-800" : "text-slate-700"}>
              {item.ok === true ? "Đúng" : item.ok === false ? "Sai" : "Đã ghi"} — thí sinh: {item.given || "(trống)"}
              {item.expected ? ` — đáp án: ${item.expected}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Essays({ essays }: { essays: AdminDetail["essays"] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-black text-slate-900">Bài viết</h2>
      {essays.map((essay) => (
        <article key={essay.task} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900">{essay.task}</h3>
          {essay.prompt ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{essay.prompt}</p> : null}
          {essay.imageUrl && isPublicChartUrl(essay.imageUrl) ? (
            // The chart URL is chosen per paper, so it is not a configured next/image host.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={essay.imageUrl} alt="Biểu đồ Task 1" className="mt-4 max-h-80 rounded-xl border border-slate-200" />
          ) : null}
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-900">{essay.essay || "(trống)"}</p>
          <p className="mt-3 text-xs font-semibold text-slate-500">{essay.wordCount} từ</p>
        </article>
      ))}
    </section>
  );
}

function Criteria({ criteria }: { criteria: AdminDetail["criteria"] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-slate-900">Nhận xét tiêu chí</h2>
      {criteria.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Chưa có nhận xét.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {criteria.map((item) => (
            <li key={item.key} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-900">
                {item.label}: {item.score.toFixed(1)}
              </p>
              <p className="mt-1 text-slate-700">{item.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SpeakingAudio({ clips }: { clips: AdminDetail["clips"] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-slate-900">Bản ghi</h2>
      <p className="mt-2 text-sm text-slate-600">Liên kết nghe có hạn 15 phút. Tải lại trang nếu không phát được.</p>
      {clips.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Không có bản ghi trong bài nộp.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {clips.map((clip) => (
            <li key={clip.path} className="rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{clip.label}</p>
              {clip.url ? (
                <audio data-testid="speaking-audio" controls preload="none" src={clip.url} className="mt-3 w-full" aria-label={clip.label}>
                  Trình duyệt không phát được bản ghi.
                </audio>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Không mở được bản ghi.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
