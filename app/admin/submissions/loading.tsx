export default function LoadingSubmissions() {
  return (
    <div aria-busy="true" aria-label="Đang tải bài nộp" className="space-y-4">
      <div className="h-10 rounded-xl bg-white border border-slate-200 animate-pulse" />
      <div className="h-80 rounded-2xl bg-white border border-slate-200 animate-pulse" />
    </div>
  );
}
