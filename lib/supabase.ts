import { createClient } from "@supabase/supabase-js";

// Khởi tạo Supabase Client rỗng nếu không có key
// Hệ thống sẽ tự động chuyển sang cơ chế Fallback (đọc file data cứng) nếu Supabase chưa được cấu hình
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
