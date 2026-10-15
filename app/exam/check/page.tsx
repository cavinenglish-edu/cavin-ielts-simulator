"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicSession } from "@/lib/exam-sitting";

type Info = PublicSession & { title?: string };

function shown(value: string): string {
  return value.trim() ? value : "Chưa có trên hồ sơ";
}

export default function PretestPage() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [message, setMessage] = useState("");
  const [volume, setVolume] = useState(80);
  const [playing, setPlaying] = useState(false);
  const [paperId, setPaperId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/exam/session", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/exam");
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as { session: PublicSession };
      if (cancelled) return;
      if (data.session.section !== "pretest") {
        router.replace(
          data.session.section === "listening"
            ? "/exam/listening"
            : data.session.section === "reading"
              ? "/exam/reading"
              : data.session.section === "writing"
                ? "/exam/writing"
                : data.session.section === "speaking"
                  ? "/exam/room"
                  : "/exam/receipt",
        );
        return;
      }
      setInfo(data.session);
      let storedId = data.session.paperId;
      try {
        const stored = JSON.parse(window.sessionStorage.getItem("ielts_candidate") || "{}") as { selectedExamId?: string };
        if (!storedId && stored.selectedExamId) storedId = stored.selectedExamId;
      } catch {
        storedId = data.session.paperId;
      }
      setPaperId(storedId);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const start = async () => {
    const response = await fetch("/api/exam/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error || "Chưa vào được phòng thi.");
      return;
    }
    const data = (await response.json()) as { next: string };
    router.push(data.next);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <section className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Computer-delivered</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Kiểm tra trước giờ thi</h1>
          <p className="mt-2 text-sm text-slate-600">Listening, rồi Reading, rồi Writing. Sau khi nộp Writing, phần Nói của chính đề này mở tiếp.</p>
        </div>

        <dl data-testid="candidate-info" className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Họ tên</dt>
            <dd className="font-bold text-slate-900">{shown(info?.name ?? "")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Tên tiếng Anh</dt>
            <dd className="font-semibold text-slate-900">{shown(info?.engName ?? "")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Số báo danh</dt>
            <dd className="font-mono font-bold text-blue-800">{shown(info?.candidateNumber ?? "")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Điện thoại</dt>
            <dd className="font-semibold text-slate-900">{shown(info?.phone ?? "")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">CCCD / Hộ chiếu</dt>
            <dd className="font-semibold text-slate-900">Chưa có trên hồ sơ</dd>
          </div>
          <div>
            <dt className="text-slate-500">Loại tài khoản</dt>
            <dd className="font-semibold text-slate-900">{info?.userType === "student" ? "Học viên" : info?.userType === "online" ? "Khách online" : "Chưa có trên hồ sơ"}</dd>
          </div>
        </dl>

        <p className="text-sm text-slate-600" role="status">{message}</p>

        <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-slate-900">Tai nghe</h2>
          <audio
            ref={audioRef}
            src="/sound-check.wav"
            preload="auto"
            onEnded={() => setPlaying(false)}
          />
          <button
            type="button"
            data-testid="headphone-play"
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              audio.volume = volume / 100;
              if (playing) {
                audio.pause();
                audio.currentTime = 0;
                setPlaying(false);
                return;
              }
              void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold"
          >
            {playing ? "Dừng" : "Phát"}
          </button>
          <label className="block text-sm text-slate-700">
            Âm lượng
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              data-testid="volume-slider"
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                if (audioRef.current) audioRef.current.volume = next / 100;
              }}
              className="mt-2 w-full accent-blue-600"
            />
          </label>
        </div>

        <button
          type="button"
          data-testid="start-test"
          disabled={!info || !paperId}
          onClick={() => void start()}
          className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-40"
        >
          Start Test
        </button>
      </section>
    </main>
  );
}
