"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <AlertOctagon className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-3">
        Đã xảy ra lỗi bất ngờ!
      </h1>
      <p className="text-slate-600 mb-8 max-w-md">
        Hệ thống giả lập IELTS gặp sự cố tải trang hoặc kết nối nội bộ. Vui lòng thử lại hoặc quay về Trang chủ.
      </p>
      
      <div className="flex items-center gap-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Thử lại</span>
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition shadow-sm"
        >
          <span>Về trang chủ</span>
        </Link>
      </div>
    </div>
  );
}
