-- Chạy script này trong phần SQL Editor của Supabase

-- 1. Xóa bảng nếu đã tồn tại (Cẩn thận khi chạy trên Production)
DROP TABLE IF EXISTS public.ielts_exams;

-- 2. Tạo bảng ielts_exams
CREATE TABLE public.ielts_exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    season TEXT NOT NULL,
    examiner_name TEXT NOT NULL,
    examiner_role TEXT NOT NULL,
    examiner_avatar TEXT NOT NULL,
    examiner_voice TEXT NOT NULL,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    part1_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    part2_topic JSONB NOT NULL DEFAULT '{}'::jsonb,
    part3_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tạo Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ielts_exams_updated_at
    BEFORE UPDATE ON public.ielts_exams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Cấu hình Row Level Security (RLS)
ALTER TABLE public.ielts_exams ENABLE ROW LEVEL SECURITY;

-- Chính sách: Ai cũng có quyền ĐỌC (SELECT) nhưng chỉ với các đề đã 'published'
CREATE POLICY "Cho phép mọi người đọc đề đã published" 
ON public.ielts_exams 
FOR SELECT 
USING (status = 'published');

-- Chính sách: Service Role (Backend/Script) có quyền thực hiện mọi thao tác (INSERT, UPDATE, DELETE)
CREATE POLICY "Cho phép Service Role toàn quyền" 
ON public.ielts_exams 
USING (true)
WITH CHECK (true);
