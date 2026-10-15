-- Lưu bài thí sinh nộp cho từng kỹ năng.
-- Chạy một lần trong SQL Editor của Supabase. Không xóa dữ liệu cũ.
-- Service role ghi bài. Không có policy cho anon/public, nên bài viết không bị đọc từ trình duyệt.

CREATE TABLE IF NOT EXISTS public.exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id TEXT NOT NULL,
  candidate_number TEXT NOT NULL,
  candidate_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  skill TEXT NOT NULL CHECK (skill IN ('listening', 'reading', 'writing', 'speaking')),
  section_started_at BIGINT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  score JSONB,
  marking_status TEXT NOT NULL DEFAULT 'saved'
    CHECK (marking_status IN ('scored', 'marked', 'pending_key', 'no_transcript', 'marking_failed', 'saved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS exam_submissions_sitting_skill
  ON public.exam_submissions (paper_id, candidate_number, phone, skill, section_started_at);

ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;
