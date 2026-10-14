"use client";

import { useEffect, useState } from "react";
import { remainingSeconds, SECTION_PATH, type PublicSession } from "@/lib/exam-sitting";

export function syncedRemaining(session: PublicSession, sinceSyncMs: number): number {
  const offset = session.clockOffsetMs > 0 ? session.clockOffsetMs : 0;
  const base = remainingSeconds(session.startedAt, session.durationSeconds, session.serverNow + offset);
  return Math.max(0, base - Math.floor(sinceSyncMs / 1000));
}

export function useSessionRefresh(apply: (session: PublicSession) => void) {
  useEffect(() => {
    const pull = async () => {
      const response = await fetch("/api/exam/session", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { session?: PublicSession };
      if (data.session) apply(data.session);
    };
    const onRefresh = () => {
      void pull();
    };
    document.addEventListener("exam-session-refresh", onRefresh);
    const id = window.setInterval(() => void pull(), 4000);
    return () => {
      document.removeEventListener("exam-session-refresh", onRefresh);
      window.clearInterval(id);
    };
  }, [apply]);
}

export function useExamCountdown(session: PublicSession): number {
  const [sinceSync, setSinceSync] = useState(0);
  const syncKey = `${session.section}:${session.listeningPhase}:${session.startedAt}:${session.durationSeconds}:${session.clockOffsetMs}:${session.serverNow}`;

  useEffect(() => {
    const origin = Date.now();
    const id = window.setInterval(() => setSinceSync(Date.now() - origin), 250);
    return () => window.clearInterval(id);
  }, [syncKey]);

  return syncedRemaining(session, sinceSync);
}

export function pathForSession(session: PublicSession): string {
  return SECTION_PATH[session.section];
}
