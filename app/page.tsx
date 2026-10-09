import Link from "next/link";
import { Mic, Clock, Award, Sparkles, ChevronRight, Volume2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="w-full border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">Cavin English</span>
              <span className="text-xs text-blue-600 font-medium ml-2 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">Simulator</span>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            cavinenglish2edu.com
          </div>
        </div>
      </header>

      {/* Main Hero Section with Centered CTA */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-8 shadow-sm">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="tracking-wide uppercase">Phòng luyện thi IELTS Speaking 1:1 Chuẩn Khảo Thí IDP/BC</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-tight mb-6">
            Hệ thống thi thử IELTS 1:1 - Cavin&apos;s English
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 max-w-xl mb-10 leading-relaxed font-normal">
            Mô phỏng áp lực phòng thi thực tế với giám khảo ảo AI, đếm giờ phản xạ tự động và chấm điểm phát âm trực tiếp theo 4 tiêu chí IELTS.
          </p>

          {/* Main Centered CTA Button */}
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/exam"
              className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-full shadow-lg shadow-blue-600/25 transition-all duration-200 cursor-pointer"
            >
              <Mic className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
              <span>Bắt đầu thi thử</span>
              <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <span className="text-xs text-slate-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Thời gian dự kiến: 11 - 14 phút
            </span>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 w-full max-w-2xl text-left">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <Mic className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-900 mb-1">Thu âm phản xạ</h3>
              <p className="text-xs text-slate-500 leading-normal">Ghi âm trực tiếp và chuyển đổi giọng nói thành văn bản chuẩn xác.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-900 mb-1">Đồng hồ chuẩn Part</h3>
              <p className="text-xs text-slate-500 leading-normal">Kiểm soát thời gian Part 1, 1 phút chuẩn bị và 2 phút Part 2.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-900 mb-1">Đánh giá 4 tiêu chí</h3>
              <p className="text-xs text-slate-500 leading-normal">Phân tích Fluency, Lexical, Grammar và Pronunciation chi tiết.</p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-100 py-8 px-6 text-center text-xs text-slate-600 flex flex-col items-center gap-2 bg-white">
        <p>© 2026 Cavin&apos;s English (cavinenglish2edu.com). All rights reserved.</p>
        <p className="max-w-4xl text-[11px] text-slate-400 leading-relaxed">
          IELTS® là thương hiệu đã đăng ký của Cambridge University Press & Assessment, IDP: IELTS Australia và British Council. Website này là hệ thống mô phỏng độc lập sử dụng phiên bản AI lõi Gemini Ultra Pro và ChatGPT Premium Max được thiết kế độc quyền cho Cavin&apos;s English.
        </p>
      </footer>
    </div>
  );
}
