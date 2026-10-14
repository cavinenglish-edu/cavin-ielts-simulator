"use client";

import { useEffect, useState } from "react";
import { emptyRecovery, parseRecovery, RECOVERY_KEY, type RecoveryState } from "@/lib/sitting-recovery";

function readStored(paperId: string): RecoveryState {
  const raw = window.sessionStorage.getItem(RECOVERY_KEY) || window.localStorage.getItem(RECOVERY_KEY);
  return parseRecovery(raw, paperId);
}

function writeStored(state: RecoveryState) {
  const raw = JSON.stringify(state);
  window.sessionStorage.setItem(RECOVERY_KEY, raw);
  window.localStorage.setItem(RECOVERY_KEY, raw);
}

export function useSittingRecovery(paperId: string) {
  const [state, setState] = useState<RecoveryState>(() => emptyRecovery(paperId));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored(paperId);
    const id = window.setTimeout(() => {
      setState(stored);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [paperId]);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(state);
  }, [hydrated, state]);

  return { state, setState, hydrated };
}
