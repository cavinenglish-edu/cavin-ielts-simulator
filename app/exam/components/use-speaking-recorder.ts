"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendAnswer, normalizeAudioMime, type SpeakingAnswerBlob, type SpeakingPart } from "@/lib/speaking-recording";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];

export function useSpeakingRecorder() {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number | null>(null);
  const answersRef = useRef<SpeakingAnswerBlob[]>([]);
  const attemptRef = useRef(0);
  const [answers, setAnswers] = useState<SpeakingAnswerBlob[]>([]);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [mic, setMic] = useState<"checking" | "ready" | "blocked">("checking");
  const [micMessage, setMicMessage] = useState("");

  const stopMeter = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    stopMeter();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
  }, [stopMeter]);

  const enableMic = useCallback(async () => {
    const attempt = ++attemptRef.current;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      if (attempt !== attemptRef.current) return false;
      setMic("blocked");
      setMicMessage("Máy này không có micro. Phần Nói chưa bắt đầu.");
      return false;
    }
    try {
      releaseStream();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (attempt !== attemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        setMic("blocked");
        setMicMessage("Không tìm thấy micro. Hãy cắm micro rồi thử lại. Phần Nói chưa bắt đầu.");
        return false;
      }
      streamRef.current = stream;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (const value of data) sum += value;
        setLevel(Math.min(100, Math.round((sum / data.length / 128) * 100)));
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
      setMic("ready");
      return true;
    } catch (error) {
      if (attempt !== attemptRef.current) return false;
      const name = error instanceof DOMException ? error.name : "";
      setMic("blocked");
      setMicMessage(
        name === "NotFoundError" || name === "NotReadableError"
          ? "Không tìm thấy micro. Hãy cắm micro rồi thử lại. Phần Nói chưa bắt đầu."
          : "Trình duyệt chưa cho dùng micro. Hãy cho phép quyền micro rồi thử lại. Phần Nói chưa bắt đầu.",
      );
      return false;
    }
  }, [releaseStream]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void enableMic();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      attemptRef.current += 1;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // The page is going away; the in-memory clip is discarded.
        }
      }
      releaseStream();
    };
  }, [enableMic, releaseStream]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || stream.getAudioTracks().every((track) => track.readyState !== "live")) return false;
    if (recorderRef.current && recorderRef.current.state === "recording") return true;
    chunksRef.current = [];
    const preferred = MIME_CANDIDATES.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
    let recorder: MediaRecorder;
    try {
      recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
    } catch {
      return false;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start();
    setRecording(true);
    return true;
  }, []);

  const stopRecording = useCallback(async (part: SpeakingPart, questionIndex: number) => {
    const recorder = recorderRef.current;
    setRecording(false);
    if (!recorder || recorder.state === "inactive") return null;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const mime = normalizeAudioMime(recorder.mimeType) ?? "audio/webm";
        resolve(new Blob(chunksRef.current, { type: mime }));
      };
      try {
        recorder.stop();
      } catch {
        resolve(new Blob([], { type: "audio/webm" }));
      }
    });
    if (blob.size === 0) return null;
    const entry: SpeakingAnswerBlob = {
      part,
      questionIndex,
      mimeType: blob.type || "audio/webm",
      blob,
    };
    answersRef.current = appendAnswer(answersRef.current, entry);
    setAnswers(answersRef.current);
    recorderRef.current = null;
    return entry;
  }, []);

  return { answers, answersRef, recording, level, mic, micMessage, enableMic, startRecording, stopRecording };
}

export async function playBeep(): Promise<void> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  try {
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
    await ctx.close();
    return;
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.16);
  await Promise.race([
    new Promise<void>((resolve) => {
      osc.onended = () => resolve();
    }),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 400);
    }),
  ]);
  if (ctx.state !== "closed") await ctx.close();
}
