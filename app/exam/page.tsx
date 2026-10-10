"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Headphones,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Info,
  Clock,
  BookOpen,
  Calendar,
  Search,
  X,
  KeyRound,
  LogOut,
  Lock,
} from "lucide-react";
import { EXAM_DATA_SETS, ExamDataSet } from "@/data/exam_data";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import ExamAuthModal, { CandidateSession } from "@/components/ExamAuthModal";

export default function ExamSetupPage() {
  const router = useRouter();
  
  const [availableExams, setAvailableExams] = useState(EXAM_DATA_SETS);
  const [isLoadingExams, setIsLoadingExams] = useState(true);

  // Lấy đề thi từ Supabase (nếu có cấu hình)
  useEffect(() => {
    async function fetchExams() {
      if (!supabase) {
        setIsLoadingExams(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("ielts_exams")
          .select("id, title, examiner_name")
          .eq("status", "published")
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        if (data && data.length > 0) {
          // Map data to match EXAM_DATA_SETS structure just for the dropdown
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formattedData: any[] = data.map(dbExam => ({
            id: dbExam.id,
            title: dbExam.title,
            examinerName: dbExam.examiner_name,
            examinerVoice: "en-GB-Standard-B", // default fallback
            examinerRole: "Senior IELTS Examiner",
            examinerAvatar: "",
          }));
          
          setAvailableExams([...formattedData, ...EXAM_DATA_SETS] as ExamDataSet[]);
        }
      } catch (err) {
        console.error("Supabase fetch error:", err);
      } finally {
        setIsLoadingExams(false);
      }
    }
    
    fetchExams();
  }, []);

  // Step tracker: 1: Candidate Info | 2: Sound Check | 3: Mic Check | 4: Ready
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showCandidateModal, setShowCandidateModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Candidate State & PIN Auth Gate
  const [candidateSession, setCandidateSession] = useState<CandidateSession | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [candidateName, setCandidateName] = useState<string>("");
  const [candidateId, setCandidateId] = useState<string>("");
  const [targetBand, setTargetBand] = useState<string>("7.5+");
  const [selectedExamId, setSelectedExamId] = useState<string>("random");
  const [candidateNumber, setCandidateNumber] = useState<string>("VN102-849201");

  useEffect(() => {
    setCandidateNumber("VN102-" + Math.floor(100000 + Math.random() * 900000));
    try {
      const saved = sessionStorage.getItem("cavin_candidate_session");
      if (saved) {
        const parsed: CandidateSession = JSON.parse(saved);
        if (parsed && parsed.isQualified) {
          setCandidateSession(parsed);
          setCandidateName(parsed.name || "");
          if (parsed.phone) setCandidateId(parsed.phone);
        }
      }
    } catch (_) {}
  }, []);

  const handleExamSelect = (examId: string) => {
    setSelectedExamId(examId);
    if (!candidateSession || !candidateSession.isQualified) {
      setShowAuthModal(true);
    } else {
      setShowCandidateModal(true);
    }
  };

  const handleAuthSuccess = (candidate: CandidateSession) => {
    setCandidateSession(candidate);
    setCandidateName(candidate.name);
    if (candidate.phone) setCandidateId(candidate.phone);
    toast.success(`Xác thực thành công! Chào mừng thí sinh ${candidate.name}`, { duration: 4000 });
    setShowCandidateModal(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("cavin_candidate_session");
    sessionStorage.removeItem("ielts_candidate");
    setCandidateSession(null);
    setCandidateName("");
    setCandidateId("");
    setCurrentStep(1);
    toast.success("Đã đăng xuất tài khoản thi thử.");
  };

  // Sound Check State
  const [isPlayingSound, setIsPlayingSound] = useState<boolean>(false);
  const [soundVolume, setSoundVolume] = useState<number>(85);
  const [soundVerified, setSoundVerified] = useState<boolean>(false);

  // Mic Check State
  const [micPermission, setMicPermission] = useState<"idle" | "granted" | "denied">("idle");
  const [isRecordingMic, setIsRecordingMic] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [micVerified, setMicVerified] = useState<boolean>(false);

  // Regulations
  const [agreeRegulations, setAgreeRegulations] = useState<boolean>(false);

  // Web Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Handler: Play Examiner Voice Sample (Sound Check)
  const handlePlaySoundCheck = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Trình duyệt không hỗ trợ tổng hợp giọng nói.");
      return;
    }

    if (isPlayingSound) {
      window.speechSynthesis.cancel();
      setIsPlayingSound(false);
      return;
    }

    window.speechSynthesis.cancel();
    const text =
      "Hello. This is the official IELTS Speaking sound check. If you can hear this instruction clearly through your headphones, your audio output is configured correctly. You may proceed to the microphone test.";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.volume = soundVolume / 100;
    utterance.rate = 0.95;

    // Pick British or English voice if available
    const voices = window.speechSynthesis.getVoices();
    const ukVoice =
      voices.find((v) => v.lang.includes("GB") || v.name.includes("UK") || v.name.includes("British")) ||
      voices.find((v) => v.lang.startsWith("en"));
    if (ukVoice) {
      utterance.voice = ukVoice;
    }

    utterance.onstart = () => setIsPlayingSound(true);
    utterance.onend = () => {
      setIsPlayingSound(false);
      setSoundVerified(true);
    };
    utterance.onerror = () => setIsPlayingSound(false);

    window.speechSynthesis.speak(utterance);
  };

  // Handler: Start 5-second Mic Test
  const handleStartMicTest = async () => {
    setAudioUrl(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMicPermission("granted");

      // Setup Web Audio Analyser for live visualizer
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Meter animation loop
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(Math.min(100, Math.round((average / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      // MediaRecorder for 5-second recording
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setIsRecordingMic(false);
        setMicVerified(true);
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
        setAudioLevel(0);
      };

      recorder.start();
      setIsRecordingMic(true);
      setCountdown(5);

      // Countdown timer
      let timeLeft = 5;
      const timer = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(timer);
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }
      }, 1000);
    } catch (err) {
      console.error("Microphone error:", err);
      setMicPermission("denied");
      toast.error("Không thể truy cập Microphone. Vui lòng bấm vào biểu tượng ổ khóa trên thanh địa chỉ trình duyệt để cấp quyền micro.", { duration: 5000 });
    }
  };

  // Handler: Play back the test recording
  const handlePlayBack = () => {
    if (!audioUrl) return;
    if (isPlayingBack && audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      setIsPlayingBack(false);
      return;
    }
    const audio = new Audio(audioUrl);
    audioPlaybackRef.current = audio;
    audio.onended = () => setIsPlayingBack(false);
    audio.play();
    setIsPlayingBack(true);
  };

  const isAllReady =
    candidateName.trim().length > 1 &&
    soundVerified &&
    micVerified &&
    agreeRegulations;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* BC / IDP Official Style Top Header Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-slate-400 hover:text-white transition flex items-center gap-1.5 text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Trang chủ</span>
            </Link>
            <div className="h-5 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-base">
                IELTS <span className="text-red-500">on Computer</span>
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Speaking Simulator
              </span>
            </div>
          </div>

          {/* Test Center Info & Auth Status */}
          <div className="flex items-center gap-4 text-xs">
            <div className="hidden md:flex items-center gap-2 text-slate-300">
              <img src="/logo.png" alt="Cavin's English" className="w-5 h-5 object-contain" />
              <span>VN102 - Cavin&apos;s English Test Center</span>
            </div>
            {candidateSession ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold truncate max-w-[150px]">{candidateSession.name}</span>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-3 py-1.5 rounded-full text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Đăng nhập PIN</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Candidate Identification Strip (Chuẩn Khảo Thí) */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-500">Thí sinh:</span>{" "}
              {candidateSession ? (
                <strong className="text-slate-900 font-bold uppercase text-sm">
                  {candidateSession.name}
                  {candidateSession.engName ? ` (${candidateSession.engName})` : ""}
                </strong>
              ) : (
                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  CHƯA ĐĂNG NHẬP
                </span>
              )}
            </div>
            <div>
              <span className="text-slate-500">Số báo danh (Candidate No):</span>{" "}
              <strong className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {candidateNumber}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Phân hạng:</span>{" "}
              {candidateSession ? (
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {candidateSession.userType === "student" ? "Học viên VIP (Đủ 3 môn)" : "Khách Online VIP"}
                </span>
              ) : (
                <span className="text-slate-500 font-medium">IELTS Computer-Delivered</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {candidateSession ? (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                title="Đăng xuất khỏi tài khoản thi thử"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đổi tài khoản / Thoát</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Nhập Mã PIN Dự Thi</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
            
            {/* Step 1 */}
            <button
              onClick={() => setCurrentStep(1)}
              className={`relative z-10 flex flex-col items-center gap-1.5 ${
                currentStep >= 1 ? "text-blue-600" : "text-slate-600"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  currentStep === 1
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : currentStep > 1
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {currentStep > 1 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
              </div>
              <span className="text-xs font-semibold">1. Chọn bộ đề</span>
            </button>

            {/* Step 2 */}
            <button
              onClick={() => setCurrentStep(2)}
              className={`relative z-10 flex flex-col items-center gap-1.5 ${
                currentStep >= 2 ? "text-blue-600" : "text-slate-600"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  currentStep === 2
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : soundVerified
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {soundVerified ? <CheckCircle2 className="w-5 h-5" /> : "2"}
              </div>
              <span className="text-xs font-semibold">2. Kiểm tra tai nghe</span>
            </button>

            {/* Step 3 */}
            <button
              onClick={() => setCurrentStep(3)}
              className={`relative z-10 flex flex-col items-center gap-1.5 ${
                currentStep >= 3 ? "text-blue-600" : "text-slate-600"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  currentStep === 3
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : micVerified
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {micVerified ? <CheckCircle2 className="w-5 h-5" /> : "3"}
              </div>
              <span className="text-xs font-semibold">3. Kiểm tra Micro</span>
            </button>

            {/* Step 4 */}
            <button
              onClick={() => setCurrentStep(4)}
              className={`relative z-10 flex flex-col items-center gap-1.5 ${
                currentStep >= 4 ? "text-blue-600" : "text-slate-600"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  currentStep === 4
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : isAllReady
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {isAllReady ? <CheckCircle2 className="w-5 h-5" /> : "4"}
              </div>
              <span className="text-xs font-semibold">4. Sẵn sàng vào thi</span>
            </button>
          </div>
        </div>

        {/* STEP 1: EXAM LIBRARY */}
        {currentStep === 1 && (
          <div className="w-full">
            {/* VIP FOMO HERO BANNER */}
            <div className="mb-8 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl border border-blue-500/30 relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wider shadow">
                      <Sparkles className="w-3.5 h-3.5" /> Đặc Quyền Khảo Thí VIP
                    </span>
                    <span className="text-xs text-blue-200 font-medium">
                      Khảo thí 1:1 • BC / IDP Standards
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
                    Phòng Luyện Thi IELTS 4 Kỹ Năng Cavin&apos;s English
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Toàn bộ thư viện đề thi thật Actual &amp; Forecast 2026 bên dưới mở khóa trực tiếp thông qua <strong>Mã PIN 4 số</strong> (Dành riêng cho học sinh đủ combo 3 lớp: Ngữ Pháp + Nghe Nói + Đọc Viết) hoặc <strong>Mã PIN 6 số</strong> (Khách kích hoạt Online).
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {candidateSession ? (
                    <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20">
                      <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Thí sinh VIP đã xác thực
                      </div>
                      <div className="text-sm font-extrabold text-white truncate max-w-[180px]">
                        {candidateSession.name}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-98 text-slate-950 font-black text-sm shadow-xl shadow-amber-400/20 transition-all cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>BẮT ĐẦU THI THỬ (MÃ PIN)</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Thư viện đề thi IELTS Speaking</h2>
                <p className="text-sm text-slate-600 mt-1">Chọn một bộ đề thi (Full Mock Test) chuẩn format IDP/BC để bắt đầu luyện tập 1:1 với AI.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pb-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === "all" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                Tất cả bộ đề
              </button>
              <button
                onClick={() => setActiveTab("new")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeTab === "new" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                🔥 Đề thi thật mới nhất (Actual)
              </button>
              <button
                onClick={() => setActiveTab("forecast")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeTab === "forecast" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                📚 Bộ đề dự đoán (Forecast)
              </button>
            </div>

            {isLoadingExams ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p>Đang tải thư viện đề thi từ máy chủ...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Random Exam Card */}
                <div 
                  onClick={() => handleExamSelect("random")}
                  className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl border border-blue-500 shadow-md hover:shadow-xl transition cursor-pointer overflow-hidden flex flex-col group text-white"
                >
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-4 text-white">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-xl mb-2">Đề thi Ngẫu Nhiên</h3>
                    <p className="text-blue-100 text-sm mb-4 line-clamp-2">
                      Mô phỏng trải nghiệm bốc đề ngẫu nhiên trong phòng thi thật. Hệ thống sẽ chọn 1 đề bất kỳ trong kho dữ liệu.
                    </p>
                    <div className="mt-auto pt-4 border-t border-blue-500/50 flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-100">Full Mock Test</span>
                      <button className="bg-white text-blue-700 px-4 py-1.5 rounded-full font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
                        Bốc đề ngay
                      </button>
                    </div>
                  </div>
                </div>

                {availableExams
                  .filter(exam => {
                    const matchSearch = exam.title.toLowerCase().includes(searchQuery.toLowerCase());
                    if (!matchSearch) return false;
                    if (activeTab === "new") return !exam.id.startsWith("static");
                    if (activeTab === "forecast") return exam.id.startsWith("static");
                    return true;
                  })
                  .map((exam) => (
                    <div 
                      key={exam.id}
                      onClick={() => handleExamSelect(exam.id)}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition cursor-pointer overflow-hidden flex flex-col group"
                    >
                      <div className="bg-slate-50 p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                          <Mic className="w-6 h-6" />
                        </div>
                        <span className="px-3 py-1 bg-white text-blue-700 font-bold text-[10px] uppercase tracking-wider rounded-full shadow-sm border border-slate-100">
                          {exam.id.startsWith("static") ? "Forecast" : "Actual Test"}
                        </span>
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="font-bold text-slate-900 text-base mb-3 group-hover:text-blue-600 transition line-clamp-2" title={exam.title}>
                          {exam.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md"><BookOpen className="w-3.5 h-3.5" /> 3 Parts</span>
                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md"><Clock className="w-3.5 h-3.5" /> 11-14 Phút</span>
                        </div>
                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${exam.examinerName}`} alt="avatar" className="w-6 h-6" />
                            </div>
                            <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px]">Khảo thí: {exam.examinerName}</span>
                          </div>
                          <span className="text-blue-600 font-semibold text-sm group-hover:underline flex items-center gap-1">
                            Vào thi <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: SOUND / HEADSET CHECK */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Headphones className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Kiểm tra Tai nghe / Loa (Sound Check)</h2>
                <p className="text-xs text-slate-600">Đảm bảo bạn nghe rõ từng câu hỏi của Giám khảo khảo thí</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center">
                <p className="text-sm text-slate-700 mb-6 max-w-md leading-relaxed">
                  Hãy đeo tai nghe vào, sau đó bấm nút <strong>&quot;Phát âm thanh mẫu&quot;</strong> bên dưới để nghe thử đoạn giới thiệu từ Giám khảo bản xứ.
                </p>

                <button
                  type="button"
                  onClick={handlePlaySoundCheck}
                  className={`inline-flex items-center gap-3 px-6 py-3.5 rounded-full font-semibold text-sm transition shadow-md cursor-pointer ${
                    isPlayingSound
                      ? "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isPlayingSound ? (
                    <>
                      <VolumeX className="w-5 h-5" />
                      <span>Đang phát... (Bấm để dừng)</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-5 h-5" />
                      <span>Phát âm thanh mẫu (Play Sound)</span>
                    </>
                  )}
                </button>

                {/* Volume Slider */}
                <div className="w-full max-w-xs mt-6 flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-slate-600" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-xs font-mono text-slate-600 w-8">{soundVolume}%</span>
                </div>
              </div>

              {/* Verification status toggle */}
              <div
                onClick={() => setSoundVerified(!soundVerified)}
                className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  soundVerified
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-900"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      soundVerified ? "bg-emerald-600 text-white" : "border-2 border-slate-300"
                    }`}
                  >
                    {soundVerified && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-semibold">
                    Tôi xác nhận nghe rõ ràng âm thanh từ tai nghe / loa
                  </span>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded bg-white/80 border border-slate-200">
                  {soundVerified ? "ĐÃ KIỂM TRA" : "CHƯA XÁC NHẬN"}
                </span>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Quay lại
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!soundVerified}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                >
                  <span>Tiếp tục: Kiểm tra Micro</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: MICROPHONE CHECK (WEB AUDIO API) */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Kiểm tra Micro thu âm (Microphone Test)</h2>
                <p className="text-xs text-slate-600">Đo cường độ âm lượng và nghe lại chất lượng giọng nói trước khi thi</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center">
                <p className="text-sm text-slate-700 mb-6 max-w-md leading-relaxed">
                  Bấm nút <strong>&quot;Nói thử 5 giây&quot;</strong>, sau đó đọc to câu mẫu:  
                  <span className="block mt-2 font-semibold text-blue-700 italic">
                    &quot;My name is {candidateName || "Candidate"} and I am ready for the test.&quot;
                  </span>
                </p>

                {/* Real-time Dynamic Waveform / Level Meter */}
                <div className="w-full max-w-md bg-white p-4 rounded-xl border border-slate-200 shadow-inner mb-6">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                    <span>Cường độ tín hiệu Micro (Live Volume)</span>
                    <span className="font-mono font-bold text-blue-600">{audioLevel}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-75 ${
                        audioLevel > 60
                          ? "bg-red-500"
                          : audioLevel > 20
                          ? "bg-emerald-500"
                          : "bg-blue-400"
                      }`}
                      style={{ width: `${Math.max(5, audioLevel)}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {!isRecordingMic ? (
                    <button
                      type="button"
                      onClick={handleStartMicTest}
                      className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition cursor-pointer"
                    >
                      <Mic className="w-5 h-5" />
                      <span>{audioUrl ? "Nói thử lại 5 giây" : "Bắt đầu nói thử 5 giây"}</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-3 px-6 py-3.5 rounded-full bg-red-600 text-white font-semibold text-sm shadow-md animate-pulse">
                      <Square className="w-4 h-4 fill-white" />
                      <span>Đang thu âm... Hãy nói câu mẫu ({countdown}s)</span>
                    </div>
                  )}

                  {/* Playback Button */}
                  {audioUrl && !isRecordingMic && (
                    <button
                      type="button"
                      onClick={handlePlayBack}
                      className={`inline-flex items-center gap-2 px-5 py-3.5 rounded-full font-semibold text-sm border transition shadow-sm cursor-pointer ${
                        isPlayingBack
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <Play className="w-4 h-4" />
                      <span>{isPlayingBack ? "Đang phát..." : "Nghe lại giọng bạn"}</span>
                    </button>
                  )}
                </div>

                {micPermission === "denied" && (
                  <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Trình duyệt đang chặn Microphone. Vui lòng bấm vào ổ khóa URL góc trên bên trái để Cho phép (Allow).</span>
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between transition ${
                  micVerified
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-900"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      micVerified ? "bg-emerald-600 text-white" : "border-2 border-slate-300"
                    }`}
                  >
                    {micVerified && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-sm font-semibold block">
                      {micVerified ? "Microphone hoạt động hoàn hảo" : "Chưa kiểm tra tín hiệu Micro"}
                    </span>
                    <span className="text-xs text-slate-600">
                      {micVerified ? "Âm thanh thu rõ ràng, đã sẵn sàng để thi" : "Cần nói thử 1 lần để hệ thống xác nhận tín hiệu"}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded bg-white/80 border border-slate-200">
                  {micVerified ? "MICROPHONE OK" : "CHỜ TEST"}
                </span>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Quay lại
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  disabled={!micVerified}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                >
                  <span>Tiếp tục: Đọc quy chế</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: REGULATIONS & ENTER EXAM ROOM */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Quy chế phòng thi & Sẵn sàng</h2>
                <p className="text-xs text-slate-600">Bạn đã hoàn thành kiểm tra thiết bị. Hãy đọc kỹ quy chế trước khi bước vào phòng thi.</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-600 block mb-1">Thí sinh:</span>
                  <strong className="text-slate-900 text-sm uppercase">{candidateName}</strong>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-600 block mb-1">Số báo danh:</span>
                  <strong className="text-blue-700 text-sm font-mono">{candidateNumber}</strong>
                </div>
              </div>

              {/* Regulations Checklist */}
              <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-700 space-y-2.5">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                  Quy định phòng thi IELTS Speaking on Computer:
                </h4>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Không đóng hoặc tải lại trang web (F5):</strong> Để đảm bảo tiến trình bài thi và dữ liệu ghi âm không bị gián đoạn.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Thời gian dự kiến:</strong> Bài thi gồm 3 Parts diễn ra liên tục từ 11 đến 14 phút.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Part 2 Cue Card:</strong> Bạn sẽ có chính xác 1 phút chuẩn bị (có bảng ghi chú nháp) và 2 phút nói liên tục.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Chấm điểm:</strong> Giám khảo AI sẽ phân tích dựa trên 4 tiêu chí chuẩn khảo thí (Fluency, Lexical, Grammar, Pronunciation).</span>
                </div>
              </div>

              {/* Agreement checkbox */}
              <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreeRegulations}
                  onChange={(e) => setAgreeRegulations(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                />
                <span className="text-xs sm:text-sm font-medium text-slate-800">
                  Tôi đã đọc kỹ và đồng ý tuân thủ toàn bộ quy chế phòng thi khảo thí.
                </span>
              </label>

              {/* Start Exam CTA */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Quay lại
                </button>

                <button
                  type="button"
                  disabled={!isAllReady}
                  onClick={() => {
                    // Store candidate info in sessionStorage for the exam room
                    if (typeof window !== "undefined") {
                      sessionStorage.setItem(
                        "ielts_candidate",
                        JSON.stringify({
                          name: candidateName,
                          id: candidateId,
                          number: candidateNumber,
                          target: targetBand,
                          selectedExamId: selectedExamId,
                        })
                      );
                    }
                    router.push("/exam/room");
                  }}
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-600/25 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>BƯỚC VÀO PHÒNG THI 1:1 (START TEST)</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* MODAL: CANDIDATE INFO */}
        {showCandidateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Xác thực hồ sơ dự thi</h3>
                    <p className="text-xs text-slate-500">Bước chuẩn bị cuối cùng trước khi vào Test Room</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCandidateModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-500 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto">
                <div className="space-y-5 text-sm">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Họ và tên thí sinh (Full Name) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="Ví dụ: NGUYEN VAN A"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                        Số CCCD / Hộ chiếu
                      </label>
                      <input
                        type="text"
                        value={candidateId}
                        onChange={(e) => setCandidateId(e.target.value)}
                        placeholder="B1234567"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                        Mục tiêu Band Score
                      </label>
                      <select
                        value={targetBand}
                        onChange={(e) => setTargetBand(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium bg-white"
                      >
                        <option value="6.0+">Band 6.0+ (Competent)</option>
                        <option value="6.5+">Band 6.5+ (Good Competent)</option>
                        <option value="7.0+">Band 7.0+ (Good User)</option>
                        <option value="7.5+">Band 7.5+ (Very Good)</option>
                        <option value="8.0+">Band 8.0+ (Expert)</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-100 flex items-start gap-3 mt-2">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900 leading-relaxed">
                      Số báo danh chính thức của bạn là <strong className="bg-white px-1 py-0.5 rounded shadow-sm">{candidateNumber}</strong>. Điểm số và nhận xét chi tiết của Giám khảo AI sẽ được lập thành bảng điểm điện tử IDP/BC Format ngay sau khi bạn hoàn thành Part 3.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowCandidateModal(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-200 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      sessionStorage.setItem(
                        "ielts_candidate",
                        JSON.stringify({
                          name: candidateName,
                          id: candidateId,
                          number: candidateNumber,
                          target: targetBand,
                          selectedExamId: selectedExamId,
                        })
                      );
                    }
                    setShowCandidateModal(false);
                    setCurrentStep(2);
                  }}
                  disabled={!candidateName.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                >
                  <span>Xác nhận & Kiểm tra thiết bị</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EXAM AUTHENTICATION GATE (PIN VERIFICATION) */}
        <ExamAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          selectedExamTitle={
            selectedExamId === "random"
              ? "Đề thi Ngẫu Nhiên (Random Mock Test)"
              : availableExams.find((e) => e.id === selectedExamId)?.title
          }
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-600 flex flex-col items-center gap-2">
        <p>© 2026 Cavin&apos;s English. All rights reserved. • Replicated IELTS Computer-Delivered Testing Standards.</p>
        <p className="max-w-4xl text-[11px] text-slate-500 leading-relaxed">
          IELTS® là thương hiệu đã đăng ký của Cambridge University Press & Assessment, IDP: IELTS Australia và British Council. Website này là hệ thống mô phỏng độc lập sử dụng phiên bản AI lõi Gemini Ultra Pro & ChatGPT Max được thiết kế độc quyền cho Cavin&apos;s English — Hệ thống tự động cập nhật và đồng bộ ngân hàng đề thi thật Forecast hàng tuần theo thời gian thực từ hội đồng thi quốc tế.
        </p>
      </footer>
    </div>
  );
}
