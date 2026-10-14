"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseSkill, roomPathForSkill, type Skill } from "@/lib/exam-skill";
import { supabase } from "@/lib/supabase";

export type CandidateExam = {
  id: string;
  title: string;
  skill: Skill;
  paper: unknown;
  candidateName: string;
  candidateNumber: string;
};

type Gate =
  | { status: "checking" }
  | { status: "config"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; exam: CandidateExam };

export function useCandidateExam(expected: Skill): Gate {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await Promise.resolve();
      if (cancelled) return;
      const session = sessionStorage.getItem("cavin_candidate_session");
      if (!session) {
        router.replace("/exam");
        return;
      }

      let examId = "";
      let candidateName = "";
      let candidateNumber = "";
      try {
        const candidate = JSON.parse(sessionStorage.getItem("ielts_candidate") || "{}") as {
          selectedExamId?: string;
          name?: string;
          number?: string;
        };
        examId = candidate.selectedExamId || "";
        candidateName = candidate.name || "";
        candidateNumber = candidate.number || "";
        if (!candidateName) {
          const auth = JSON.parse(session) as { name?: string };
          candidateName = auth.name || "";
        }
      } catch {
        examId = "";
      }

      if (!examId || examId === "random") {
        setGate({ status: "error", message: "Chưa chọn đề trong thư viện." });
        return;
      }
      if (!supabase) {
        setGate({
          status: "config",
          message: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY. Không tải được đề.",
        });
        return;
      }

      const { data, error } = await supabase
        .from("ielts_exams")
        .select("id, title, skill, paper, status")
        .eq("id", examId)
        .eq("status", "published")
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        const missingColumn = /skill|paper|schema cache|column/i.test(error.message);
        setGate({
          status: "config",
          message: missingColumn
            ? "Supabase chưa có cột skill hoặc paper. Chạy scripts/supabase_skill_migration.sql."
            : "Không tải được đề từ Supabase.",
        });
        return;
      }
      if (!data) {
        setGate({ status: "error", message: "Không tìm thấy đề đã xuất bản." });
        return;
      }
      const skill = parseSkill(data.skill);
      if (skill !== expected) {
        router.replace(roomPathForSkill(skill));
        return;
      }
      setGate({
        status: "ready",
        exam: {
          id: String(data.id),
          title: String(data.title ?? "Đề thi"),
          skill,
          paper: data.paper,
          candidateName,
          candidateNumber,
        },
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [expected, router]);

  return gate;
}
