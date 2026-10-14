-- Thêm kỹ năng và nội dung Nghe/Đọc/Viết vào bảng ielts_exams đang có.
-- Không xóa đề cũ. Đề Speaking hiện tại được gán skill = speaking, paper = {}.
-- Chạy file này trong SQL Editor. Đừng chạy lại scripts/supabase_schema.sql nếu bảng đã có dữ liệu.

ALTER TABLE public.ielts_exams
  ADD COLUMN IF NOT EXISTS skill TEXT NOT NULL DEFAULT 'speaking';

ALTER TABLE public.ielts_exams
  DROP CONSTRAINT IF EXISTS ielts_exams_skill_check;

ALTER TABLE public.ielts_exams
  ADD CONSTRAINT ielts_exams_skill_check
  CHECK (skill IN ('listening', 'reading', 'writing', 'speaking'));

ALTER TABLE public.ielts_exams
  ADD COLUMN IF NOT EXISTS paper JSONB NOT NULL DEFAULT '{}'::jsonb;
