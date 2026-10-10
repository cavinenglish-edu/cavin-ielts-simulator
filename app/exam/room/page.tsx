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
  Clock,
  HelpCircle,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Edit3,
  FileText,
  AlertCircle,
  Award,
  Headphones,
  RotateCw,
} from "lucide-react";
import {
  EXAM_DATA_SETS,
  ExamDataSet,
  QuestionItem,
  getExamDataSetById,
} from "@/data/exam_data";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

// Speech Recognition Type Shim
interface IWindow extends Window {
  webkitSpeechRecognition?: new () => SpeechRecognition;
  SpeechRecognition?: new () => SpeechRecognition;
}

type ExamPhase =
  | "p1_welcome"
  | "p1_questions"
  | "p2_intro"
  | "p2_prep"
  | "p2_speak"
  | "p3_intro"
  | "p3_questions"
  | "completed";

export default function ExamRoomPage() {
  const router = useRouter();

  // Candidate Data (loaded from sessionStorage or fallback)
  const [candidate, setCandidate] = useState({
    name: "Cavin Le",
    id: "B1298492",
    number: "VN102-849201",
    target: "7.5+",
    selectedExamId: "forecast-2026-travel",
  });

  // Current Active Forecast Question Set
  const [currentExamData, setCurrentExamData] = useState<ExamDataSet>(EXAM_DATA_SETS[0]);

  // Display Mode: "exam" (hidden text, listen only) vs "practice" (text visible)
  const [displayMode, setDisplayMode] = useState<"exam" | "practice">("exam");

  // Exam Progress State Machine
  const [phase, setPhase] = useState<ExamPhase>("p1_welcome");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);

  // Examiner State
  const [isExaminerSpeaking, setIsExaminerSpeaking] = useState<boolean>(false);
  const [examinerSpeechText, setExaminerSpeechText] = useState<string>("");

  // Candidate State
  const [isCandidateRecording, setIsCandidateRecording] = useState<boolean>(false);
  const [questionTimer, setQuestionTimer] = useState<number>(35);
  const [scratchpadNotes, setScratchpadNotes] = useState<string>("");
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Collected Responses for Assessment
  const [collectedAnswers, setCollectedAnswers] = useState<
    Array<{
      questionId: string;
      questionText: string;
      part: number;
      transcript: string;
      durationSeconds: number;
    }>
  >([]);

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentAnswerStartRef = useRef<number>(0);
  const examinerAudioRef = useRef<HTMLAudioElement | null>(null);

  // Helper: Map examiner profile to authentic Native Neural Examiner Voice
  const resolveExaminerVoice = (dataSet?: ExamDataSet): string => {
    const targetData = dataSet || currentExamData;
    const name = (targetData?.examinerName || "").toLowerCase();
    const role = (targetData?.examinerRole || "").toLowerCase();
    const voice = (targetData?.examinerVoice || "").toLowerCase();

    // Australian IDP Examiners (e.g. Sarah Jenkins, Natasha, William)
    if (name.includes("sarah") || name.includes("natasha") || voice.includes("au") || role.includes("idp")) {
      return "en-AU-NatashaNeural";
    }
    if (name.includes("william")) {
      return "en-AU-WilliamMultilingualNeural";
    }
    // British Female Examiners (e.g. Emma Watson-Taylor, Sonia)
    if (name.includes("emma") || name.includes("sonia") || name.includes("ms.") || name.includes("mrs.")) {
      return "en-GB-SoniaNeural";
    }
    // British Male Examiners (e.g. Dr. James Campbell, Thomas)
    if (name.includes("james") || name.includes("thomas") || name.includes("dr.")) {
      return "en-GB-ThomasNeural";
    }
    // Default Senior British Council Examiner (Mr. David Harrison / Ryan)
    return "en-GB-RyanNeural";
  };

  // Helper: Preload next question audio silently into browser cache
  const preloadAudio = (text: string, voiceName: string) => {
    if (!text || typeof window === "undefined") return;
    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voiceName)}`;
      const preloadTag = new Audio();
      preloadTag.preload = "auto";
      preloadTag.src = audioUrl;
    } catch {
      // ignore
    }
  };

  // Helper: Examiner speaks text using Studio-Grade Native Neural TTS (with resilient fallback)
  const speakExaminerPrompt = (text: string, dataSet?: ExamDataSet, onFinish?: () => void) => {
    if (!text || typeof window === "undefined") {
      if (onFinish) onFinish();
      return;
    }

    // Stop any existing examiner speech
    if (examinerAudioRef.current) {
      examinerAudioRef.current.pause();
      examinerAudioRef.current.currentTime = 0;
      examinerAudioRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setExaminerSpeechText(text);
    setIsExaminerSpeaking(true);

    const targetData = dataSet || currentExamData;
    const voiceName = resolveExaminerVoice(targetData);
    const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voiceName)}`;

    // Fallback handler if network or audio decode fails
    const fallbackToSpeechSynthesis = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-GB";
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const ukVoice =
          voices.find((v) => v.lang.includes("GB") || v.name.includes("UK") || v.name.includes("British")) ||
          voices.find((v) => v.lang.startsWith("en"));
        if (ukVoice) utterance.voice = ukVoice;

        utterance.onend = () => {
          setIsExaminerSpeaking(false);
          if (onFinish) onFinish();
        };
        utterance.onerror = () => {
          setIsExaminerSpeaking(false);
          if (onFinish) onFinish();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setIsExaminerSpeaking(false);
        if (onFinish) onFinish();
      }
    };

    try {
      const audio = new Audio(audioUrl);
      examinerAudioRef.current = audio;

      audio.onended = () => {
        setIsExaminerSpeaking(false);
        examinerAudioRef.current = null;
        if (onFinish) onFinish();
      };

      audio.onerror = () => {
        console.warn("Neural TTS streaming error, falling back to Web Speech API");
        fallbackToSpeechSynthesis();
      };

      audio.play().catch((err) => {
        console.warn("Audio autoplay policy or playback error, falling back:", err);
        fallbackToSpeechSynthesis();
      });
    } catch (e) {
      console.error("Audio constructor error:", e);
      fallbackToSpeechSynthesis();
    }
  };

  // Load candidate info & Forecast Set on mount
  useEffect(() => {
    async function initExamData() {
      if (typeof window === "undefined") return;
      
      const authSession = sessionStorage.getItem("cavin_candidate_session");
      if (!authSession) {
        toast.error("Vui lòng xác thực mã PIN bảo mật trước khi vào phòng thi.");
        router.replace("/exam");
        return;
      }

      const stored = sessionStorage.getItem("ielts_candidate");
      let chosenData = EXAM_DATA_SETS[0];

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCandidate((prev) => ({ ...prev, ...parsed }));

          if (parsed.selectedExamId === "random") {
            const randIdx = Math.floor(Math.random() * EXAM_DATA_SETS.length);
            chosenData = EXAM_DATA_SETS[randIdx];
          } else if (parsed.selectedExamId.startsWith("static_")) {
            chosenData = getExamDataSetById(parsed.selectedExamId);
          } else if (supabase) {
            // Fetch live from Supabase
            try {
              const { data, error } = await supabase
                .from("ielts_exams")
                .select("*")
                .eq("id", parsed.selectedExamId)
                .single();
                
              if (error) throw error;
              if (data) {
                chosenData = {
                  id: data.id,
                  title: data.title,
                  season: data.season,
                  examinerName: data.examiner_name,
                  examinerRole: data.examiner_role,
                  examinerAvatar: data.examiner_avatar,
                  examinerVoice: data.examiner_voice,
                  part1: {
                    welcome: `Good afternoon, my name is ${data.examiner_name.split(' ')[1] || 'David'}. Could you tell me your full name, please?`,
                    questions: data.part1_topics.flatMap((t: any) => t.questions.map((q: string) => ({ id: `dyn_${Math.random()}`, question: q, recommendedDurationSeconds: 40 })))
                  },
                  part2: {
                    id: "dyn_p2",
                    topicTitle: data.part2_topic.title,
                    taskCardPrompt: data.part2_topic.content,
                    bulletPoints: data.part2_topic.bulletPoints,
                    prepTimeSeconds: 60,
                    speakTimeSeconds: 120
                  },
                  part3: {
                    topicIntro: "We've been talking about " + data.part2_topic.title + ", and I'd like to ask you some more general questions related to this.",
                    questions: data.part3_questions.map((q: any) => ({ id: q.id, question: q.question, recommendedDurationSeconds: 60 }))
                  }
                } as unknown as ExamDataSet;
              }
            } catch (err) {
              console.error("Failed to fetch exam from Supabase, falling back to static", err);
              chosenData = EXAM_DATA_SETS[0];
            }
          }
        } catch (e) {
          console.error("Failed to parse candidate data:", e);
        }
      }

      setCurrentExamData(chosenData);

      // Kickstart Examiner Welcome Greeting after brief pause
      setTimeout(() => {
        speakExaminerPrompt(chosenData.part1.welcome, chosenData);
      }, 1200);
    }
    
    initExamData();
  }, []);

  // Initialize Speech Recognition & Microphone Stream
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Setup Web Speech Recognition
    const win = window as unknown as IWindow;
    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setLiveTranscript(currentText);
      };

      recognition.onerror = (e: unknown) => {
        console.warn("Speech recognition error:", e);
      };

      recognitionRef.current = recognition;
    }

    // Request Mic & Setup Analyser
    async function initMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const audioCtx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

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
      } catch (err) {
        console.error("Mic initialization failed:", err);
        toast.error("Không thể kết nối Micro. Vui lòng kiểm tra quyền truy cập Micro trên trình duyệt.", { duration: 5000 });
      }
    }

    initMic();

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (examinerAudioRef.current) {
        examinerAudioRef.current.pause();
        examinerAudioRef.current = null;
      }
    };
  }, []);

  // Candidate requests examiner to repeat question
  const handleRepeatQuestion = () => {
    if (isExaminerSpeaking || !examinerSpeechText) return;
    speakExaminerPrompt(examinerSpeechText);
  };

  // Helper: Start candidate response recording
  const startCandidateRecording = (durationSeconds: number) => {
    setIsCandidateRecording(true);
    setLiveTranscript("");
    setQuestionTimer(durationSeconds);
    currentAnswerStartRef.current = Date.now();

    // Start STT
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // already started
      }
    }

    // Start Audio Recorder
    if (mediaStreamRef.current) {
      try {
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(mediaStreamRef.current);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start();
      } catch (e) {
        console.error("Recorder start failed:", e);
      }
    }

    // Countdown Timer
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    let remaining = durationSeconds;
    timerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setQuestionTimer(remaining);
      if (remaining <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        finishCandidateAnswer();
      }
    }, 1000);
  };

  // Helper: Stop recording and save candidate answer
  const finishCandidateAnswer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsCandidateRecording(false);

    // Stop STT
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    // Stop Recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    const duration = Math.round((Date.now() - currentAnswerStartRef.current) / 1000);

    // Determine current question info
    let qId = "";
    let qText = "";
    let partNum = 1;

    if (phase === "p1_questions") {
      const currentQ = currentExamData.part1.questions[currentQuestionIndex];
      qId = currentQ?.id || "p1";
      qText = currentQ?.question || "";
      partNum = 1;
    } else if (phase === "p2_speak") {
      qId = currentExamData.part2.id;
      qText = currentExamData.part2.topicTitle;
      partNum = 2;
    } else if (phase === "p3_questions") {
      const currentQ = currentExamData.part3.questions[currentQuestionIndex];
      qId = currentQ?.id || "p3";
      qText = currentQ?.question || "";
      partNum = 3;
    }

    setCollectedAnswers((prev) => [
      ...prev,
      {
        questionId: qId,
        questionText: qText,
        part: partNum,
        transcript: liveTranscript || "(Answer recorded via microphone)",
        durationSeconds: duration,
      },
    ]);

    // Advance State Machine
    advanceToNextStep();
  };

  // State Machine Controller: Advance flow
  const advanceToNextStep = () => {
    const voiceName = resolveExaminerVoice(currentExamData);

    if (phase === "p1_welcome") {
      setPhase("p1_questions");
      setCurrentQuestionIndex(0);
      const firstQ = currentExamData.part1.questions[0];
      speakExaminerPrompt(firstQ.question, currentExamData, () => {
        startCandidateRecording(firstQ.recommendedDurationSeconds);
        // Preload next question while candidate speaks
        if (currentExamData.part1.questions[1]) {
          preloadAudio(currentExamData.part1.questions[1].question, voiceName);
        }
      });
    } else if (phase === "p1_questions") {
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < currentExamData.part1.questions.length) {
        setCurrentQuestionIndex(nextIndex);
        const nextQ = currentExamData.part1.questions[nextIndex];
        speakExaminerPrompt(nextQ.question, currentExamData, () => {
          startCandidateRecording(nextQ.recommendedDurationSeconds);
          // Preload upcoming prompt
          if (nextIndex + 1 < currentExamData.part1.questions.length) {
            preloadAudio(currentExamData.part1.questions[nextIndex + 1].question, voiceName);
          } else {
            preloadAudio(
              "Thank you. Now, in Part 2, I am going to give you a topic, and I'd like you to talk about it for one to two minutes. Before you talk, you will have one minute to think about what you are going to say. You can make some notes if you wish. Here is your topic card.",
              voiceName
            );
          }
        });
      } else {
        // Part 1 complete -> Part 2 Intro
        setPhase("p2_intro");
        const introText =
          "Thank you. Now, in Part 2, I am going to give you a topic, and I'd like you to talk about it for one to two minutes. Before you talk, you will have one minute to think about what you are going to say. You can make some notes if you wish. Here is your topic card.";
        speakExaminerPrompt(introText, currentExamData, () => {
          startPart2Preparation();
        });
      }
    } else if (phase === "p2_prep") {
      // Prep finished -> Start 2 min speak
      setPhase("p2_speak");
      const speakPrompt =
        "Your one minute preparation is up. Remember, you have one to two minutes for this. Don't worry if I stop you. Please begin speaking now.";
      speakExaminerPrompt(speakPrompt, currentExamData, () => {
        startCandidateRecording(currentExamData.part2.speakTimeSeconds);
        // Preload Part 3 intro while candidate gives 2-minute talk
        preloadAudio(currentExamData.part3.topicIntro, voiceName);
        if (currentExamData.part3.questions[0]) {
          preloadAudio(currentExamData.part3.questions[0].question, voiceName);
        }
      });
    } else if (phase === "p2_speak") {
      // Part 2 complete -> Part 3 Intro
      setPhase("p3_intro");
      speakExaminerPrompt(currentExamData.part3.topicIntro, currentExamData, () => {
        setPhase("p3_questions");
        setCurrentQuestionIndex(0);
        const firstP3Q = currentExamData.part3.questions[0];
        speakExaminerPrompt(firstP3Q.question, currentExamData, () => {
          startCandidateRecording(firstP3Q.recommendedDurationSeconds);
          if (currentExamData.part3.questions[1]) {
            preloadAudio(currentExamData.part3.questions[1].question, voiceName);
          }
        });
      });
    } else if (phase === "p3_questions") {
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < currentExamData.part3.questions.length) {
        setCurrentQuestionIndex(nextIndex);
        const nextQ = currentExamData.part3.questions[nextIndex];
        speakExaminerPrompt(nextQ.question, currentExamData, () => {
          startCandidateRecording(nextQ.recommendedDurationSeconds);
          if (nextIndex + 1 < currentExamData.part3.questions.length) {
            preloadAudio(currentExamData.part3.questions[nextIndex + 1].question, voiceName);
          } else {
            preloadAudio(
              "Thank you very much. That is the end of the Speaking test. Your responses have been recorded and are now ready to be assessed according to the official IELTS criteria.",
              voiceName
            );
          }
        });
      } else {
        // Exam Finished!
        finishFullExam();
      }
    }
  };

  // Start Part 2 Preparation (60 seconds countdown + scratchpad)
  const startPart2Preparation = () => {
    setPhase("p2_prep");
    setQuestionTimer(currentExamData.part2.prepTimeSeconds);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    let remaining = currentExamData.part2.prepTimeSeconds;
    timerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setQuestionTimer(remaining);
      if (remaining <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        advanceToNextStep();
      }
    }, 1000);
  };

  // Finish Full Exam
  const finishFullExam = () => {
    setPhase("completed");
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const conclusion =
      "Thank you very much. That is the end of the Speaking test. Your responses have been recorded and are now ready to be assessed according to the official IELTS criteria.";
    speakExaminerPrompt(conclusion);

    // Save final exam data to sessionStorage for Report page
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "ielts_exam_submission",
        JSON.stringify({
          candidate,
          examTitle: currentExamData.title,
          season: currentExamData.season,
          examinerName: currentExamData.examinerName,
          completedAt: new Date().toISOString(),
          answers: collectedAnswers,
          scratchpad: scratchpadNotes,
        })
      );
    }
  };

  // Examiner Initials
  const examinerInitials = currentExamData.examinerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Word count & pace
  const wordCount = liveTranscript.trim() ? liveTranscript.trim().split(/\s+/).length : 0;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* BC/IDP Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-extrabold tracking-tight text-white text-base">
              IELTS <span className="text-red-500">on Computer</span>
            </span>
            <div className="h-4 w-px bg-slate-700 hidden sm:block" />
            <span className="text-xs text-slate-300 font-mono hidden sm:inline">
              Candidate: <strong className="text-white">{candidate.name}</strong> ({candidate.number})
            </span>
          </div>

          {/* Center: Current Part Indicator Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                phase.startsWith("p1")
                  ? "bg-blue-600 text-white"
                  : phase.startsWith("p2")
                  ? "bg-amber-600 text-white animate-pulse"
                  : phase.startsWith("p3")
                  ? "bg-purple-600 text-white"
                  : "bg-emerald-600 text-white"
              }`}
            >
              {phase.startsWith("p1") && "Part 1: General Interview"}
              {phase.startsWith("p2") && "Part 2: Individual Long Turn"}
              {phase.startsWith("p3") && "Part 3: Two-way Discussion"}
              {phase === "completed" && "Test Completed"}
            </span>
          </div>

          {/* Right: Display Mode Toggle (Exam vs Practice) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDisplayMode(displayMode === "exam" ? "practice" : "exam")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Chuyển chế độ: Chuẩn phòng thi (giấu chữ) hoặc Luyện tập (hiện chữ)"
            >
              {displayMode === "exam" ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exam Mode (Chỉ nghe)</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>Practice Mode (Hiện chữ)</span>
                </>
              )}
            </button>

            <Link
              href="/exam"
              className="text-xs text-slate-400 hover:text-white px-2 py-1 transition flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cài đặt lại</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Examination Stage */}
      <main className="max-w-6xl mx-auto px-6 py-6 flex-1 w-full flex flex-col gap-6">
        {/* COMPLETED SCREEN */}
        {phase === "completed" ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 max-w-2xl mx-auto text-center my-auto">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6">
              <Award className="w-10 h-10" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
              Chúc mừng bạn đã hoàn thành bài thi IELTS Speaking!
            </h2>
            <p className="text-slate-600 text-sm max-w-md mx-auto mb-8 leading-relaxed">
              Toàn bộ dữ liệu ghi âm và bản gỡ băng của bạn ở cả 3 Part đã được lưu trữ an toàn. Hệ thống AI đang sẵn sàng phân tích 4 tiêu chí khảo thí.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs mb-8 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Thí sinh:</span>
                <strong className="text-slate-800">{candidate.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số báo danh:</span>
                <strong className="font-mono text-blue-700">{candidate.number}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bộ đề hoàn thành:</span>
                <strong className="text-slate-800">{currentExamData.title}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tổng số câu trả lời:</span>
                <strong className="text-emerald-700">{collectedAnswers.length} phần thi</strong>
              </div>
            </div>

            <button
              onClick={() => router.push("/exam/report")}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-600/25 transition cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>XEM BẢNG ĐIỂM TEST REPORT FORM (TRF)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        ) : (
          /* ACTIVE EXAM ROOM GRID */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
            {/* LEFT / MAIN COLUMN: EXAMINER STAGE & CANDIDATE INTERFACE */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* EXAMINER VIRTUAL BOOTH */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden">
                {/* Background Wave Accents */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />

                {/* Examiner Avatar & Speech Pulse */}
                <div className="relative mb-4">
                  <div
                    className={`w-24 h-24 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-4 flex items-center justify-center text-white shadow-lg transition-all duration-300 ${
                      isExaminerSpeaking
                        ? "border-blue-500 ring-8 ring-blue-100 scale-105"
                        : "border-slate-200"
                    }`}
                  >
                    <span className="text-2xl font-bold tracking-tight">{examinerInitials}</span>
                  </div>

                  {/* Examiner Live Speaking Icon */}
                  {isExaminerSpeaking && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md animate-bounce">
                      <Volume2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Examiner Identity */}
                <h3 className="text-base font-bold text-slate-900">
                  {currentExamData.examinerName}
                </h3>
                <span className="text-xs text-slate-500 mb-6">
                  {currentExamData.examinerRole} • British Council / IDP Certified
                </span>

                {/* Status Indicator Pill */}
                <div className="mb-6">
                  {isExaminerSpeaking ? (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                      <Volume2 className="w-4 h-4" />
                      <span>Giám khảo đang đặt câu hỏi... (Hãy chú ý lắng nghe)</span>
                    </span>
                  ) : phase === "p2_prep" ? (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-4 h-4" />
                      <span>1 Phút Chuẩn Bị: Hãy phác thảo dàn ý vào Giấy nháp bên dưới</span>
                    </span>
                  ) : isCandidateRecording ? (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                      <Mic className="w-4 h-4" />
                      <span>Lượt của bạn: Hãy nói tự nhiên vào Micro</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Sẵn sàng cho câu hỏi tiếp theo</span>
                    </span>
                  )}
                </div>

                {/* Question Display (Subject to Display Mode) */}
                <div className="w-full bg-slate-50 rounded-2xl p-6 border border-slate-200 min-h-[110px] flex items-center justify-center text-center">
                  {displayMode === "exam" && isExaminerSpeaking ? (
                    <div className="flex flex-col items-center gap-2 text-slate-500 text-xs">
                      <Headphones className="w-6 h-6 text-blue-600 animate-pulse" />
                      <span>Chế độ Exam Mode: Giám khảo đang nói (tập trung phản xạ nghe)</span>
                    </div>
                  ) : (
                    <p className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed max-w-2xl">
                      &quot;{examinerSpeechText || currentExamData.part1.welcome}&quot;
                    </p>
                  )}
                </div>

                {/* Start First Question button if in welcome phase */}
                {phase === "p1_welcome" && !isExaminerSpeaking && (
                  <button
                    onClick={advanceToNextStep}
                    className="mt-6 inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition cursor-pointer"
                  >
                    <span>SẴN SÀNG: BẮT ĐẦU PART 1</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* CANDIDATE INTERACTION BOOTH */}
              {(isCandidateRecording || phase === "p2_prep") && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col gap-6">
                  {/* Timer & Level Bar Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {phase === "p2_prep" ? "Thời gian chuẩn bị:" : "Thời gian trả lời còn lại:"}
                      </span>
                    </div>

                    {/* Big Digital Countdown */}
                    <div
                      className={`font-mono font-extrabold text-2xl px-4 py-1 rounded-xl border ${
                        questionTimer <= 10
                          ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                          : "bg-slate-100 text-slate-900 border-slate-200"
                      }`}
                    >
                      00:{questionTimer < 10 ? `0${questionTimer}` : questionTimer}
                    </div>
                  </div>

                  {/* PART 2 CUE CARD SPECIAL VIEW */}
                  {phase.startsWith("p2") && (
                    <div className="p-6 rounded-2xl bg-amber-50/60 border-2 border-amber-200/80">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                          Candidate Task Card
                        </span>
                        <span className="text-xs text-amber-700 font-medium">1-2 phút nói liên tục</span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900 mb-3">
                        {currentExamData.part2.topicTitle}
                      </h4>
                      <p className="text-xs font-semibold text-slate-700 mb-2">
                        {currentExamData.part2.taskCardPrompt}
                      </p>
                      <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 pl-2">
                        {currentExamData.part2.bulletPoints.map((bp, i) => (
                          <li key={i}>{bp}</li>
                        ))}
                      </ul>

                      {/* Electronic Scratchpad during Part 2 */}
                      <div className="mt-6 pt-4 border-t border-amber-200/60">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                            <Edit3 className="w-4 h-4" />
                            <span>Giấy nháp điện tử (Electronic Scratchpad - Take Notes):</span>
                          </label>
                          <span className="text-[11px] text-amber-700">Tự do ghi chú từ khóa</span>
                        </div>
                        <textarea
                          rows={3}
                          value={scratchpadNotes}
                          onChange={(e) => setScratchpadNotes(e.target.value)}
                          placeholder="Ghi chú nhanh các ý chính cho bài nói..."
                          className="w-full p-3 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-xs bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* Audio Level Visualizer while candidate speaks */}
                  {isCandidateRecording && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span>Tín hiệu Micro thí sinh:</span>
                        <span className="font-mono font-bold text-emerald-600">{audioLevel}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-75"
                          style={{ width: `${Math.max(5, audioLevel)}%` }}
                        />
                      </div>

                      {/* Real-time STT preview */}
                      {liveTranscript && (
                        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                          <div className="flex items-center justify-between text-slate-500 font-semibold mb-1">
                            <span>Bản gỡ băng giọng nói thời gian thực (Live Transcript):</span>
                            <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {wordCount} từ đã nói
                            </span>
                          </div>
                          <span className="italic text-slate-800">&quot;{liveTranscript}&quot;</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Candidate Action Buttons */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    {/* Repeat question button */}
                    {isCandidateRecording ? (
                      <button
                        type="button"
                        onClick={handleRepeatQuestion}
                        disabled={isExaminerSpeaking}
                        className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition cursor-pointer disabled:opacity-50"
                        title="Yêu cầu Giám khảo nhắc lại câu hỏi (Chuẩn khảo thí cho phép hỏi lại 1-2 lần)"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                        <span>Nghe lại câu hỏi</span>
                      </button>
                    ) : <div />}

                    <div className="flex items-center gap-3">
                      {phase === "p2_prep" ? (
                        <button
                          onClick={advanceToNextStep}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md transition cursor-pointer"
                        >
                          <span>Sẵn sàng nói sớm (Bỏ qua thời gian chuẩn bị)</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={finishCandidateAnswer}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Hoàn thành câu trả lời (Next Question)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: EXAM OVERVIEW & PROGRESS MONITOR */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Test Information Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Thông tin đợt thi</span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mã thí sinh:</span>
                    <strong className="font-mono text-slate-800">{candidate.number}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Chủ đề:</span>
                    <strong className="text-slate-800">{currentExamData.category}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bộ đề:</span>
                    <span className="font-semibold text-blue-700">{currentExamData.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mục tiêu:</span>
                    <span className="px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Band {candidate.target}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quy chuẩn:</span>
                    <strong className="text-slate-800">Khảo thí BC/IDP (4 tiêu chí)</strong>
                  </div>
                </div>
              </div>

              {/* 3-Part Progress Tracker */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Tiến độ 3 Parts</span>
                  </div>
                  <span className="text-slate-400 font-normal">11-14 phút</span>
                </div>

                <div className="space-y-3">
                  {/* Part 1 */}
                  <div
                    className={`p-3 rounded-xl border transition ${
                      phase.startsWith("p1")
                        ? "bg-blue-50/70 border-blue-300 text-blue-900"
                        : phase.startsWith("p2") || phase.startsWith("p3")
                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                        : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Part 1: Phỏng vấn đời thường</span>
                      {phase.startsWith("p1") ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 text-white rounded">
                          ĐANG THI
                        </span>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {currentExamData.part1.questions.length} câu hỏi khởi động
                    </span>
                  </div>

                  {/* Part 2 */}
                  <div
                    className={`p-3 rounded-xl border transition ${
                      phase.startsWith("p2")
                        ? "bg-amber-50/70 border-amber-300 text-amber-900"
                        : phase.startsWith("p3")
                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                        : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Part 2: Thuyết trình Cue Card</span>
                      {phase.startsWith("p2") ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-600 text-white rounded">
                          ĐANG THI
                        </span>
                      ) : phase.startsWith("p3") ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span className="text-[10px] text-slate-400">CHỜ</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      1 phút chuẩn bị + 2 phút nói liên tục
                    </span>
                  </div>

                  {/* Part 3 */}
                  <div
                    className={`p-3 rounded-xl border transition ${
                      phase.startsWith("p3")
                        ? "bg-purple-50/70 border-purple-300 text-purple-900"
                        : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Part 3: Thảo luận chuyên sâu</span>
                      {phase.startsWith("p3") ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-600 text-white rounded">
                          ĐANG THI
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">CHỜ</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {currentExamData.part3.questions.length} câu hỏi phản biện mở rộng
                    </span>
                  </div>
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-xs text-blue-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <span>Quyền lợi thí sinh chuẩn khảo thí:</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Trong kỳ thi IELTS thật, bạn hoàn toàn có thể yêu cầu giám khảo nhắc lại câu hỏi nếu chưa nghe rõ bằng cách bấm nút <strong>&quot;Nghe lại câu hỏi&quot;</strong>.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BC/IDP Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
        <p>© 2026 Cavin English (cavinenglish2edu.com) • Replicated IELTS Computer-Delivered Testing Standards.</p>
        <p className="max-w-4xl text-[11px] text-slate-400 leading-relaxed">
          IELTS® là thương hiệu đã đăng ký của Cambridge University Press & Assessment, IDP: IELTS Australia và British Council. Website này là hệ thống mô phỏng độc lập và không có liên kết trực tiếp hoặc được ủy quyền bởi các tổ chức trên.
        </p>
      </footer>
    </div>
  );
}
