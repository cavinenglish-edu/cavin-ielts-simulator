"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  X,
  Phone,
  ArrowRight,
  ExternalLink,
  Sparkles,
  GraduationCap,
  BookOpen,
  MessageCircle,
  Clock,
  Layers
} from "lucide-react";

export interface CandidateSession {
  pin: string;
  name: string;
  engName?: string;
  phone?: string;
  email?: string;
  userType: "student" | "online";
  classes?: string[];
  packageType?: string;
  expiry?: string;
  isQualified: boolean;
}

interface ExamAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (candidate: CandidateSession) => void;
  selectedExamTitle?: string;
}

export default function ExamAuthModal({
  isOpen,
  onClose,
  onSuccess,
  selectedExamTitle,
}: ExamAuthModalProps) {
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<"IDLE" | "NOT_QUALIFIED" | "NOT_FOUND" | "EXPIRED" | "ERROR">("IDLE");
  const [errorData, setErrorData] = useState<{
    message?: string;
    detail?: string;
    candidate?: Partial<CandidateSession>;
  }>({});

  if (!isOpen) return null;

  const handleReset = () => {
    setErrorStatus("IDLE");
    setErrorData({});
    setPin("");
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = pin.trim().replace(/\D/g, "");
    if (!cleanPin) {
      alert("Vui lòng nhập mã PIN bảo mật!");
      return;
    }

    if (cleanPin.length !== 4 && cleanPin.length !== 6) {
      setErrorStatus("ERROR");
      setErrorData({
        message: "Định dạng mã PIN không đúng!",
        detail: "Mã PIN học viên trung tâm gồm 4 chữ số (trong sổ học bạ). Mã PIN khách online gồm 6 chữ số (trong email kích hoạt)."
      });
      return;
    }

    setIsLoading(true);
    setErrorStatus("IDLE");

    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: cleanPin,
          phone: phone.trim().replace(/\D/g, "")
        }),
      });

      const data = await res.json();

      if (res.ok && data.status === "SUCCESS") {
        // Save candidate to session
        const cand: CandidateSession = data.candidate;
        try {
          sessionStorage.setItem("cavin_candidate_session", JSON.stringify(cand));
          localStorage.setItem("cavin_last_pin", cleanPin);
        } catch (_) {}

        onSuccess(cand);
        onClose();
      } else if (data.status === "NOT_QUALIFIED") {
        setErrorStatus("NOT_QUALIFIED");
        setErrorData(data);
      } else if (data.status === "EXPIRED") {
        setErrorStatus("EXPIRED");
        setErrorData(data);
      } else {
        setErrorStatus("NOT_FOUND");
        setErrorData(data);
      }
    } catch (err) {
      console.error("Auth error:", err);
      setErrorStatus("ERROR");
      setErrorData({
        message: "Lỗi kết nối máy chủ!",
        detail: "Không thể kiểm tra dữ liệu vào lúc này. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STATE: NOT_QUALIFIED (FOMO REJECTED MODAL) */}
        {errorStatus === "NOT_QUALIFIED" ? (
          <div className="p-8 text-center flex flex-col items-center">
            {/* VIP Lock Icon */}
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-300 text-amber-600 flex items-center justify-center mb-5 relative shadow-inner">
              <Lock className="w-10 h-10" />
              <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                VIP ONLY
              </div>
            </div>

            <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 mb-2">
              Đặc quyền chưa mở khóa
            </span>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
              Chưa đủ điều kiện tham gia
            </h3>

            <p className="text-sm text-slate-600 max-w-md mb-5 leading-relaxed">
              Chào bạn <strong className="text-slate-900 font-bold">{errorData.candidate?.name}</strong>! 
              Hệ thống ghi nhận bạn hiện chỉ mới theo học:
            </p>

            {/* Currently enrolled classes list */}
            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-5 text-left">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Lớp học hiện tại trên hệ thống:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {errorData.candidate?.classes && errorData.candidate.classes.length > 0 ? (
                  errorData.candidate.classes.map((cls, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm"
                    >
                      {cls}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">Chưa ghi nhận lớp học</span>
                )}
              </div>
            </div>

            {/* Required Combo Explanation */}
            <div className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-6 text-left">
              <div className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Điều kiện mở khóa Phòng thi VIP IDP/BC:</span>
              </div>
              <p className="text-xs text-amber-950/90 leading-relaxed mb-3">
                Thí sinh phải đăng ký <strong>trọn bộ Combo 3 lớp</strong> để đảm bảo nền tảng đạt mục tiêu Band điểm:
              </p>
              <ul className="text-xs text-amber-900 space-y-1.5 font-medium pl-1">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span><strong>Ngữ Pháp:</strong> Nâng Cao hoặc Chuyên Sâu</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span><strong>Nghe Nói:</strong> Nâng Cao hoặc Chuyên Sâu</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span><strong>Đọc Viết:</strong> Đọc Viết IELTS</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row gap-3">
              <a
                href="https://zalo.me/0969343625"
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Nâng cấp lộ trình (Zalo Admin)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition cursor-pointer"
              >
                Thử mã PIN khác
              </button>
            </div>
          </div>
        ) : errorStatus === "NOT_FOUND" || errorStatus === "EXPIRED" || errorStatus === "ERROR" ? (
          /* STATE: ERROR / NOT FOUND / EXPIRED */
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-slate-900 mb-2">
              {errorStatus === "EXPIRED" ? "Gói thi thử đã hết hạn" : "Không tìm thấy hồ sơ"}
            </h3>

            <p className="text-sm text-slate-600 max-w-sm mb-6 leading-relaxed">
              {errorData.message || errorData.detail}
            </p>

            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition cursor-pointer"
              >
                Nhập lại mã PIN
              </button>
              <a
                href="https://zalo.me/0969343625"
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 text-blue-600" />
                <span>Hỗ trợ qua Zalo Admin</span>
              </a>
            </div>
          </div>
        ) : (
          /* STATE: DEFAULT PIN LOGIN FORM */
          <form onSubmit={handleVerify} className="p-6 sm:p-8">
            {/* Header Badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    Cavin&apos;s Exam Gate
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    VIP 1:1
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Xác thực mã PIN thí sinh để mở khóa phòng thi
                </p>
              </div>
            </div>

            {selectedExamTitle && (
              <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Bài thi chuẩn bị làm:</span>
                <strong className="text-slate-900 truncate max-w-[220px]" title={selectedExamTitle}>
                  {selectedExamTitle}
                </strong>
              </div>
            )}

            {/* PIN Input Field */}
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Mã PIN Bảo Mật (Security PIN) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Nhập 4 số hoặc 6 số"
                  autoFocus
                  className="w-full text-center tracking-[0.3em] font-mono text-2xl font-black px-4 py-3.5 rounded-2xl border-2 border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
                <span>• <strong>4 số:</strong> Học viên lớp học</span>
                <span>• <strong>6 số:</strong> Khách online VIP</span>
              </p>
            </div>

            {/* Optional Phone Toggle */}
            <div className="mb-6">
              {!showPhoneInput ? (
                <button
                  type="button"
                  onClick={() => setShowPhoneInput(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium underline flex items-center gap-1 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Xác thực thêm Số điện thoại (tùy chọn)</span>
                </button>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Số Điện Thoại Phụ Huynh / Học Sinh (Tùy chọn)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ví dụ: 0969343625"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:outline-none text-sm font-medium"
                  />
                </div>
              )}
            </div>

            {/* FOMO VIP Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5 mb-6">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-950/90 leading-relaxed">
                Hệ thống tự động kiểm tra điều kiện đăng ký <strong>Combo 3 lớp</strong> (Ngữ Pháp + Nghe Nói + Đọc Viết) từ cơ sở dữ liệu để cấp quyền vào phòng thi chuẩn khảo thí.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || pin.length < 4}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-98 text-white font-bold text-base shadow-lg shadow-blue-600/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang đối chiếu dữ liệu...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-5 h-5" />
                  <span>Mở Khóa Phòng Thi</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

            {/* Assistance Link */}
            <div className="mt-4 text-center">
              <a
                href="https://zalo.me/0969343625"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-500 hover:text-slate-800 transition inline-flex items-center gap-1"
              >
                <span>Chưa có mã PIN hoặc cần hỗ trợ? Liên hệ Zalo Admin (0969.343.625)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
