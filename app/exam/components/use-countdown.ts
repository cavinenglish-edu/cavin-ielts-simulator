"use client";

import { useEffect, useRef, useState } from "react";

export function useCountdown(totalSeconds: number, running: boolean, onDone: () => void): number {
  const [left, setLeft] = useState(totalSeconds);
  const done = useRef(onDone);
  const fired = useRef(false);

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running || left !== 0 || fired.current) return;
    fired.current = true;
    done.current();
  }, [left, running]);

  return left;
}
