import Link from "next/link";
import { 
  Clock, 
  Sparkles, 
  ChevronRight, 
  Rocket, 
  Headphones, 
  BookOpenCheck, 
  PenTool, 
  KeyRound 
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="w-full border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Cavin's English Logo" 
              className="w-10 h-10 object-contain rounded-xl"
            />
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">Cavin&apos;s English</span>
              <span className="text-xs text-blue-600 font-medium ml-2 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">Simulator</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              cavinenglish2edu.com
            </span>
            <Link
              href="/exam"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs shadow-sm transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Đăng nhập PIN</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero Section with Centered CTA */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold mb-8 shadow-sm">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="tracking-wide uppercase">Hệ Thống Luyện Thi IELTS 4 Kỹ Năng Chuẩn Khảo Thí IDP/BC</span>
          </div>

          {/* Main Title - No Hyphen */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-tight mb-6">
            Hệ thống thi thử IELTS 1:1 <span className="text-blue-600">Cavin&apos;s English</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed font-normal">
            Mô phỏng áp lực phòng thi thực tế với giám khảo ảo AI Độc Quyền, chuẩn hóa quy trình luyện thi toàn diện 4 kỹ năng Nghe - Nói - Đọc - Viết theo format IDP/BC, chấm chữa chuyên sâu tức thì và bứt phá mục tiêu Band điểm.
          </p>

          {/* Main Centered CTA Button */}
          <div className="flex flex-col items-center">
            <Link
              href="/exam"
              className="group relative inline-flex items-center justify-center gap-3 px-9 py-4 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-full shadow-lg shadow-blue-600/25 transition-all duration-200 cursor-pointer"
            >
              <Rocket className="w-5 h-5 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5" />
              <span>BẮT ĐẦU THI THỬ</span>
              <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5 mt-3">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Thời gian dự kiến: 11 - 14 phút</span>
            </div>
          </div>

          {/* Feature Highlights - 4 Comprehensive Skills IDP/BC Standards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-16 w-full max-w-4xl text-center">
            {/* Listening */}
            <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/70 flex flex-col items-center text-center hover:bg-slate-50 hover:shadow-sm transition">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 mx-auto">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mb-1">Nghe Khảo Thí</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Audio chuẩn giọng bản xứ Anh - Úc - Mỹ, trắc nghiệm & điền từ format IDP/BC.</p>
            </div>

            {/* Reading */}
            <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/70 flex flex-col items-center text-center hover:bg-slate-50 hover:shadow-sm transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3 mx-auto">
                <BookOpenCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mb-1">Đọc Học Thuật</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Giao diện chia đôi màn hình chuẩn thi máy, highlight từ khóa và chấm điểm tức thì.</p>
            </div>

            {/* Writing */}
            <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/70 flex flex-col items-center text-center hover:bg-slate-50 hover:shadow-sm transition">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3 mx-auto">
                <PenTool className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mb-1">Viết Task 1 & 2</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Bộ gõ trực tiếp, đếm từ thời gian thực, AI phân tích cấu trúc bài luận & ngữ pháp.</p>
            </div>

            {/* Speaking */}
            <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/70 flex flex-col items-center text-center hover:bg-slate-50 hover:shadow-sm transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mb-1">Nói 1:1 Khảo Thí</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Phỏng vấn phản xạ 3 Parts với Giám khảo AI bản xứ, chấm chuẩn 4 tiêu chí TRF.</p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-100 py-8 px-6 text-center text-xs text-slate-600 flex flex-col items-center gap-2 bg-white">
        <p>© 2026 Cavin&apos;s English. All rights reserved.</p>
        <p className="max-w-4xl text-[11px] text-slate-500 leading-relaxed">
          IELTS® là thương hiệu đã đăng ký của Cambridge University Press & Assessment, IDP: IELTS Australia và British Council. Website này là hệ thống mô phỏng độc lập sử dụng phiên bản AI lõi Gemini Ultra Pro & ChatGPT Max được thiết kế độc quyền cho Cavin&apos;s English — Hệ thống tự động cập nhật và đồng bộ ngân hàng đề thi thật Forecast hàng tuần theo thời gian thực từ hội đồng thi quốc tế.
        </p>
      </footer>
    </div>
  );
}

