import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load biến môi trường từ .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

export interface ManualExamInput {
  title: string;
  season: string;
  examiner_name?: string;
  examiner_role?: string;
  examiner_avatar?: string;
  examiner_voice?: string;
  part1_topics: Array<{
    id: string;
    title: string;
    questions: string[];
  }>;
  part2_topic: {
    id: string;
    title: string;
    content: string;
    bulletPoints: string[];
  };
  part3_questions: Array<{
    id: string;
    question: string;
    type?: string;
  }>;
}

/**
 * Hàm hỗ trợ đẩy bộ đề thi thủ công vào Supabase
 */
export async function importExamToSupabase(exam: ManualExamInput) {
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ LỖI: Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
    return null;
  }

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const payload = {
    title: exam.title,
    season: exam.season,
    examiner_name: exam.examiner_name || "Mr. David Harrison",
    examiner_role: exam.examiner_role || "Senior Certified IELTS Examiner",
    examiner_avatar: exam.examiner_avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    examiner_voice: exam.examiner_voice || "en-GB-Standard-B",
    status: "published",
    part1_topics: exam.part1_topics,
    part2_topic: exam.part2_topic,
    part3_questions: exam.part3_questions,
  };

  console.log(`📤 Đang tải bộ đề "${payload.title}" lên Supabase...`);

  const { data, error } = await supabase
    .from("ielts_exams")
    .insert([payload])
    .select();

  if (error) {
    console.error("❌ Lỗi khi tải lên Supabase:", error.message);
    throw error;
  }

  console.log("✅ Thành công! Đề thi đã được đăng tải lên hệ thống với ID:", data[0].id);
  return data[0];
}

console.log("ℹ️ Utility script import_manual_exam sẵn sàng để nhận dữ liệu đề thủ công.");
