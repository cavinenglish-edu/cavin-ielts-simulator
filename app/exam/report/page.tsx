"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  ChevronLeft,
  Download,
  Share2,
  FileText,
  BarChart3,
  MessageCircle,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Star,
  Activity,
  Volume2,
  Mic,
  Edit3
} from "lucide-react";
import { ExamSubmission, EvaluationResult } from "@/types";
import toast from "react-hot-toast";

export default function ReportPage() {
  const router = useRouter();
  
  const [submission, setSubmission] = useState<ExamSubmission | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedSubmission = sessionStorage.getItem("ielts_exam_submission");
    if (!storedSubmission) {
      router.push("/");
      return;
    }

    const parsed = JSON.parse(storedSubmission);
    setSubmission(parsed);

    const evaluateExam = async () => {
      // Simulate AI loading steps
      const steps = [
        "Đang trích xuất văn bản (Speech-to-Text) từ file ghi âm...",
        "Đang phân tích Tiêu chí Fluency & Coherence...",
        "Đang quét từ vựng và thành ngữ (Lexical Resource)...",
        "Đang chấm điểm ngữ pháp (Grammatical Range & Accuracy)...",
        "Đang phân tích phát âm và ngữ điệu (Pronunciation)...",
        "Đang tổng hợp Bảng điểm TRF (Test Report Form)..."
      ];

      for (let i = 0; i < steps.length; i++) {
        setAnalysisStep(i);
        await new Promise((r) => setTimeout(r, 600));
      }

      try {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });
        
        if (res.ok) {
          const data = await res.json();
          setResult(data);
        } else {
          console.error("Evaluation failed");
          toast.error("Quá trình phân tích AI gặp sự cố. Vui lòng thử lại sau.", { duration: 5000 });
        }
      } catch (err) {
        console.error(err);
        toast.error("Mất kết nối mạng hoặc không thể gọi API. Vui lòng kiểm tra lại đường truyền.", { duration: 5000 });
      } finally {
        setIsLoading(false);
      }
    };

    evaluateExam();
  }, [router]);

  if (isLoading) {
    const steps = [
      "Đang trích xuất văn bản (Speech-to-Text) từ file ghi âm...",
      "Đang phân tích Tiêu chí Fluency & Coherence...",
      "Đang quét từ vựng và thành ngữ (Lexical Resource)...",
      "Đang chấm điểm ngữ pháp (Grammatical Range & Accuracy)...",
      "Đang phân tích phát âm và ngữ điệu (Pronunciation)...",
      "Đang tổng hợp Bảng điểm TRF (Test Report Form)..."
    ];

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 relative mb-8">
          <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Giám khảo AI đang chấm điểm</h2>
        <p className="text-blue-400 font-mono text-sm mb-12 h-6">{steps[analysisStep]}</p>
        
        <div className="w-full max-w-md bg-slate-800 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-blue-500 h-full transition-all duration-500 ease-out"
            style={{ width: `${((analysisStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  }

  if (!result || !submission) return null;

  const { candidate, examTitle } = submission;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* TRF Header Strip */}
      <div className="bg-white border-b-4 border-red-600 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-500 hover:text-slate-900 transition flex items-center gap-1 text-sm font-medium">
              <ChevronLeft className="w-4 h-4" /> Về trang chủ
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition cursor-pointer">
              <Share2 className="w-4 h-4" /> Chia sẻ
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition cursor-pointer">
              <Download className="w-4 h-4" /> Xuất PDF TRF
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 mt-8 space-y-6">
        {/* OFFICIAL TRF DOCUMENT CONTAINER */}
        <div className="bg-white border border-slate-300 shadow-lg rounded-sm overflow-hidden">
          
          {/* TRF Header */}
          <div className="bg-slate-100 border-b border-slate-300 p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Test Report Form</h1>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded border border-red-200">
                  Academic & General
                </span>
              </div>
              <p className="text-sm text-slate-600 font-medium">International English Language Testing System</p>
            </div>
            
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Centre Number</p>
                <p className="font-mono text-lg font-bold text-slate-900">VN102</p>
              </div>
              <div className="w-px h-10 bg-slate-300"></div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Date</p>
                <p className="font-mono text-lg font-bold text-slate-900">
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Candidate Details */}
          <div className="p-8 border-b border-slate-300 bg-white grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs text-slate-500 uppercase col-span-1">Candidate Name</span>
                <strong className="text-sm text-slate-900 col-span-2 uppercase">{candidate.name}</strong>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs text-slate-500 uppercase col-span-1">Candidate ID</span>
                <strong className="text-sm text-slate-900 col-span-2 font-mono">{candidate.id}</strong>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs text-slate-500 uppercase col-span-1">Candidate No.</span>
                <strong className="text-sm text-slate-900 col-span-2 font-mono text-blue-700">{candidate.number}</strong>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs text-slate-500 uppercase col-span-1">Test Module</span>
                <strong className="text-sm text-slate-900 col-span-2">Speaking Simulator 1:1</strong>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs text-slate-500 uppercase col-span-1">Test Topic</span>
                <strong className="text-sm text-slate-900 col-span-2">{examTitle}</strong>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs text-slate-500 uppercase col-span-1">Target Band</span>
                <strong className="text-sm text-slate-900 col-span-2">{candidate.target}</strong>
              </div>
            </div>
          </div>

          {/* Test Results Band Scores */}
          <div className="p-8 bg-slate-50">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 text-center">IELTS Speaking Component Scores</h3>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
              
              {/* Overall Band Box */}
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-500"></div>
                <div className="relative bg-white border-2 border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center w-48 h-48 shadow-xl">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Overall Band</span>
                  <span className="text-6xl font-extrabold text-blue-700 tracking-tighter">
                    {result.overall.toFixed(1)}
                  </span>
                  <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5" /> CEF Level C1
                  </div>
                </div>
              </div>

              {/* 4 Criteria Grid */}
              <div className="grid grid-cols-2 gap-4 flex-1 w-full max-w-lg">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Fluency (FC)</span>
                    <span className="text-2xl font-bold text-slate-800">{result.criteria.fc.score.toFixed(1)}</span>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-100" />
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Lexical (LR)</span>
                    <span className="text-2xl font-bold text-slate-800">{result.criteria.lr.score.toFixed(1)}</span>
                  </div>
                  <FileText className="w-8 h-8 text-blue-100" />
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Grammar (GRA)</span>
                    <span className="text-2xl font-bold text-slate-800">{result.criteria.gra.score.toFixed(1)}</span>
                  </div>
                  <Edit3 className="w-8 h-8 text-blue-100" />
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Pronunciation (P)</span>
                    <span className="text-2xl font-bold text-slate-800">{result.criteria.p.score.toFixed(1)}</span>
                  </div>
                  <Mic className="w-8 h-8 text-blue-100" />
                </div>
              </div>

            </div>
          </div>
          
          {/* Examiner Comments */}
          <div className="p-8 border-t border-slate-300 bg-white">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 mb-6 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" /> Examiner Comments & Feedback
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(result.criteria).map(([key, criterion]) => (
                <div key={key} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                      {key.toUpperCase()}
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm">{criterion.title}</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed pl-8">
                    {criterion.comments}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* DETAILED TRANSCRIPT & SUGGESTIONS */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" /> Bóc Băng & Đề Xuất Nâng Band 8.0+
          </h2>
          
          <div className="space-y-6">
            {result.detailedFeedback.map((feedback, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-900 text-white px-6 py-4 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold flex-shrink-0 text-sm">
                    Q{idx + 1}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1 block">Part {feedback.part} Question</span>
                    <p className="text-sm font-medium leading-relaxed">{feedback.question}</p>
                  </div>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Candidate Answer */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" /> Câu trả lời thực tế của bạn
                    </h4>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 italic leading-relaxed relative">
                      &quot;{feedback.originalTranscript}&quot;
                    </div>
                  </div>

                  {/* AI Suggested Answer */}
                  <div>
                    <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Star className="w-4 h-4" /> Gợi ý trả lời Band 8.0+
                    </h4>
                    <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 text-sm text-emerald-900 leading-relaxed font-medium">
                      {feedback.improvedAnswer}
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold text-slate-700">Từ vựng ghi điểm:</span>
                    <div className="flex gap-2 flex-wrap">
                      {feedback.suggestedVocabulary.map((vocab: string, vIdx: number) => (
                        <span key={vIdx} className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-blue-700">
                          {vocab}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-medium max-w-sm">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Lỗi ngữ pháp: {feedback.grammarFixes}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* BC/IDP Footer */}
      <footer className="mt-12 bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
        <p>© 2026 Cavin English (cavinenglish2edu.com) • Replicated IELTS Computer-Delivered Testing Standards.</p>
        <p className="max-w-4xl text-[11px] text-slate-400 leading-relaxed">
          IELTS® là thương hiệu đã đăng ký của Cambridge University Press & Assessment, IDP: IELTS Australia và British Council. Website này là hệ thống mô phỏng độc lập và không có liên kết trực tiếp hoặc được ủy quyền bởi các tổ chức trên.
        </p>
      </footer>
    </div>
  );
}
