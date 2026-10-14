"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, Volume2 } from "lucide-react";
import type { ExamDataSet } from "@/data/exam_data";
import { isRetiredSpeakingSet } from "@/lib/exam-catalog";
import {
  answerSeconds,
  extensionForMime,
  part2Clock,
  RECORDING_LEAVE_WARNING,
  type SpeakingPart,
} from "@/lib/speaking-recording";
import { SpeakingPart2 } from "@/app/exam/components/speaking-part2";
import { playBeep, useSpeakingRecorder } from "@/app/exam/components/use-speaking-recorder";

type Phase = "p1" | "p2_prep" | "p2_speak" | "p3" | "uploading" | "saved" | "upload-error";
type Gate = "loading" | "missing" | "early" | "ready";

function voiceFor(exam: ExamDataSet): string {
  const name = exam.examinerName.toLowerCase();
  if (name.includes("emma") || name.includes("sonia") || name.includes("ms.")) return "en-GB-SoniaNeural";
  if (name.includes("william") || exam.examinerVoice === "en-AU") return "en-AU-NatashaNeural";
  if (exam.examinerVoice === "en-US") return "en-US-GuyNeural";
  if (name.includes("thomas") || name.includes("james")) return "en-GB-ThomasNeural";
  return "en-GB-RyanNeural";
}

export default function SpeakingRoom({ preview }: { preview: "prep" | "record" | null }) {
  const router = useRouter();
  const recorder = useSpeakingRecorder();
  const [gate, setGate] = useState<Gate>("loading");
  const [exam, setExam] = useState<ExamDataSet | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [candidateNumber, setCandidateNumber] = useState("");
  const [phase, setPhase] = useState<Phase>("p1");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [examinerText, setExaminerText] = useState("");
  const [examinerSpeaking, setExaminerSpeaking] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);
  const busyRef = useRef(false);
  const examRef = useRef<ExamDataSet | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const countdown = (seconds: number, onDone: () => void) => {
    clearTimer();
    setSecondsLeft(seconds);
    let remaining = seconds;
    timerRef.current = window.setInterval(() => {
      remaining -= 1;
      setSecondsLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearTimer();
        onDone();
      }
    }, 1000);
  };

  const speak = (text: string, onFinish?: () => void) => {
    const current = examRef.current;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setExaminerText(text);
    setExaminerSpeaking(true);
    const finish = () => {
      setExaminerSpeaking(false);
      onFinish?.();
    };
    if (!current || !text) {
      finish();
      return;
    }
    const audio = new Audio(`/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voiceFor(current))}`);
    audioRef.current = audio;
    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().catch(finish);
  };

  const uploadAll = async () => {
    setPhase("uploading");
    setUploadError("");
    const clips = recorder.answersRef.current;
    if (clips.length === 0) {
      setUploadError("Không có bản ghi để lưu.");
      setPhase("upload-error");
      return;
    }
    const form = new FormData();
    for (const clip of clips) {
      const ext = extensionForMime(clip.mimeType) ?? "webm";
      form.append("audio", clip.blob, `part${clip.part}-q${clip.questionIndex}.${ext}`);
      form.append("part", String(clip.part));
      form.append("questionIndex", String(clip.questionIndex));
      form.append("mimeType", clip.mimeType);
    }
    const response = await fetch("/api/exam/speaking/upload", { method: "POST", body: form });
    const data = (await response.json().catch(() => null)) as { error?: string; next?: string } | null;
    if (!response.ok) {
      setUploadError(data?.error || "Không lưu được bản ghi.");
      setPhase("upload-error");
      return;
    }
    setPhase("saved");
    const advance = await fetch("/api/exam/advance", { method: "POST" });
    if (!advance.ok) return;
    const body = (await advance.json()) as { next?: string };
    if (body.next) router.push(body.next);
  };

  const endCapture = async (part: SpeakingPart, index: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    clearTimer();
    await recorder.stopRecording(part, index);
    busyRef.current = false;
    const current = examRef.current;
    if (!current) return;
    if (part === 1) {
      const next = index + 1;
      if (next < current.part1.questions.length) {
        beginPart1(next);
        return;
      }
      speak(
        "Thank you. Now, in Part 2, I am going to give you a topic. You have one minute to prepare, then up to two minutes to speak.",
        () => beginPrep(),
      );
      return;
    }
    if (part === 2) {
      if (current.part3.questions.length === 0) {
        void uploadAll();
        return;
      }
      speak(current.part3.topicIntro, () => beginPart3(0));
      return;
    }
    const next = index + 1;
    if (next < current.part3.questions.length) {
      beginPart3(next);
      return;
    }
    void uploadAll();
  };

  const beginCapture = (part: SpeakingPart, index: number, seconds: number) => {
    if (part === 2) setPhase("p2_speak");
    if (!recorder.startRecording()) {
      setUploadError("Micro chưa sẵn sàng. Phần Nói chưa ghi.");
      return;
    }
    countdown(seconds, () => void endCapture(part, index));
  };

  const beginPart1 = (index: number) => {
    const current = examRef.current;
    const question = current?.part1.questions[index];
    if (!current || !question) return;
    setPhase("p1");
    setQuestionIndex(index);
    speak(question.question, () => {
      void playBeep().then(() => beginCapture(1, index, answerSeconds(1, question.recommendedDurationSeconds)));
    });
  };

  const beginPart3 = (index: number) => {
    const current = examRef.current;
    const question = current?.part3.questions[index];
    if (!current || !question) {
      void uploadAll();
      return;
    }
    setPhase("p3");
    setQuestionIndex(index);
    speak(question.question, () => {
      void playBeep().then(() => beginCapture(3, index, answerSeconds(3, question.recommendedDurationSeconds)));
    });
  };

  const beginPrep = () => {
    const current = examRef.current;
    if (!current) return;
    setPhase("p2_prep");
    countdown(part2Clock(current.part2).prep, () => void beginPart2Recording());
  };

  const beginPart2Recording = async () => {
    const current = examRef.current;
    if (!current) return;
    setPhase("p2_speak");
    await playBeep();
    beginCapture(2, 0, part2Clock(current.part2).speak);
  };

  useEffect(() => {
    const warn = phase === "p2_prep" || recorder.recording;
    if (!warn) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = RECORDING_LEAVE_WARNING;
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [phase, recorder.recording]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const storedId = window.sessionStorage.getItem("ielts_candidate");
      let selectedId = "";
      if (storedId) {
        try {
          const parsed = JSON.parse(storedId) as { selectedExamId?: string; name?: string; number?: string };
          selectedId = parsed.selectedExamId ?? "";
          if (parsed.name) setCandidateName(parsed.name);
          if (parsed.number) setCandidateNumber(parsed.number);
        } catch {
          selectedId = "";
        }
      }
      if (selectedId === "random" || isRetiredSpeakingSet(selectedId)) {
        setGate("missing");
        return;
      }
      const response = await fetch(`/api/exam/speaking${selectedId ? `?id=${encodeURIComponent(selectedId)}` : ""}`, { cache: "no-store" });
      if (cancelled) return;
      if (response.status === 401) {
        router.replace("/exam");
        return;
      }
      if (response.status === 409) {
        setGate("early");
        return;
      }
      if (!response.ok) {
        setGate("missing");
        return;
      }
      const data = (await response.json()) as { paper?: ExamDataSet; candidateName?: string; candidateNumber?: string };
      if (!data.paper || isRetiredSpeakingSet(data.paper.id, data.paper.title) || data.paper.part1.questions.length === 0) {
        setGate("missing");
        return;
      }
      if (data.candidateName) setCandidateName(data.candidateName);
      if (data.candidateNumber) setCandidateNumber(data.candidateNumber);
      examRef.current = data.paper;
      setExam(data.paper);
      setExaminerText(data.paper.part1.welcome);
      setGate("ready");
    }
    void load();
    return () => {
      cancelled = true;
      clearTimer();
      if (audioRef.current) audioRef.current.pause();
    };
  }, [router]);

  useEffect(() => {
    if (gate !== "ready" || !exam || recorder.mic !== "ready") return;
    const timer = window.setTimeout(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      examRef.current = exam;
      if (preview === "prep") {
        beginPrep();
        return;
      }
      if (preview === "record") {
        void beginPart2Recording();
        return;
      }
      speak(exam.part1.welcome, () => beginPart1(0));
    }, 0);
    return () => window.clearTimeout(timer);
    // The sitting starts once, after the microphone check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, exam, recorder.mic, preview]);

  if (gate !== "ready" || !exam) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <section data-testid="speaking-room-empty" className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-xl font-bold text-slate-900">
            {gate === "loading" ? "Đang mở đề" : gate === "early" ? "Chưa tới phần Nói" : "Không có đề Speaking"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {gate === "loading"
              ? "Hệ thống đang kiểm tra đề đã chọn."
              : gate === "early"
                ? "Đề thật làm Nghe, Đọc, rồi Viết trước. Phần Nói dùng câu hỏi của chính đề đó."
                : "Thư viện không còn bộ đề này. Forecast chỉ hiện sau khi Admin xuất bản."}
          </p>
          <Link href="/exam" className="mt-6 inline-flex text-sm font-bold text-blue-700">
            Về thư viện
          </Link>
        </section>
      </main>
    );
  }

  if (recorder.mic !== "ready") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <section data-testid="speaking-mic-check" className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-xl font-bold text-slate-900">{recorder.mic === "checking" ? "Đang kiểm tra micro" : "Chưa dùng được micro"}</h1>
          <p data-testid="speaking-mic-blocked" className="mt-2 text-sm text-slate-700" role="alert">
            {recorder.mic === "checking" ? "Hãy cho phép micro khi trình duyệt hỏi. Phần Nói chưa bắt đầu." : recorder.micMessage}
          </p>
          {recorder.mic === "blocked" ? (
            <button type="button" onClick={() => void recorder.enableMic()} className="mt-6 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">
              Thử micro lại
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  const partLabel = phase === "p2_prep" || phase === "p2_speak" ? "Part 2" : phase === "p3" ? "Part 3" : phase === "p1" ? "Part 1" : "Speaking";
  const activeQuestion =
    phase === "p1" ? exam.part1.questions[questionIndex]?.question : phase === "p3" ? exam.part3.questions[questionIndex]?.question : "";
  const captureActive = phase === "p2_prep" || recorder.recording;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span className="font-extrabold">
            IELTS <span className="text-red-500">Speaking</span>
          </span>
          <span data-testid="speaking-part-label" className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">
            {partLabel}
          </span>
          <span className="text-xs text-slate-300">
            {candidateName} {candidateNumber}
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-6">
        {captureActive ? (
          <p className="sr-only" data-testid="recording-leave-guard">
            {RECORDING_LEAVE_WARNING}
          </p>
        ) : null}

        {phase === "p2_prep" || phase === "p2_speak" ? (
          <SpeakingPart2
            topic={exam.part2}
            mode={phase === "p2_speak" && recorder.recording ? "recording" : "prep"}
            secondsLeft={secondsLeft}
            level={recorder.level}
          />
        ) : phase === "uploading" || phase === "saved" || phase === "upload-error" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8">
            <h1 className="text-xl font-bold text-slate-900">
              {phase === "uploading" ? "Đang lưu bản ghi" : phase === "saved" ? "Đã lưu bản ghi" : "Chưa lưu được bản ghi"}
            </h1>
            {phase === "upload-error" ? (
              <>
                <p data-testid="speaking-upload-error" className="mt-2 text-sm text-red-700" role="alert">
                  {uploadError}
                </p>
                <button type="button" onClick={() => void uploadAll()} className="mt-6 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">
                  Thử lưu lại
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                {phase === "saved" ? "Các đoạn webm đã gửi vào kho của phiên PIN này." : "Đừng tải lại trang khi bản ghi còn trong máy."}
              </p>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-8">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-800">
              {examinerSpeaking ? <Volume2 className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {examinerSpeaking ? "Giám khảo đang nói" : recorder.recording ? "Đang ghi câu trả lời" : "Sẵn sàng"}
            </p>
            <p data-testid="speaking-prompt" className="mt-4 text-lg font-semibold text-slate-900">
              {examinerSpeaking ? examinerText : activeQuestion || examinerText}
            </p>
            {recorder.recording ? (
              <p data-testid="speaking-answer-timer" className="mt-4 font-mono text-3xl font-black text-slate-900">
                {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
              </p>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
