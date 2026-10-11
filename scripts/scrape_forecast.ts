/**
 * DEPRECATED & DISABLED: scripts/scrape_forecast.ts
 * 
 * Tính năng AI tự động cào đề đã chính thức được tắt theo yêu cầu của quản trị viên.
 * Toàn bộ quy trình cập nhật đề thi chuyển sang cơ chế:
 * 1. Người dùng/giảng viên tìm kiếm và kiểm duyệt đề thi thủ công.
 * 2. Cập nhật trực tiếp vào hệ thống:
 *    - Bộ đề tĩnh: data/exam_data.ts
 *    - Cơ sở dữ liệu: scripts/import_manual_exam.ts (Supabase)
 */

console.warn(
  "\n🛑 [THÔNG BÁO] Tính năng AI tự động cào đề đã được TẮT theo yêu cầu.\n" +
  "👉 Hệ thống không tự động cào dữ liệu từ bên ngoài nữa.\n" +
  "👉 Vui lòng sử dụng scripts/import_manual_exam.ts hoặc gửi đề trực tiếp để cập nhật vào hệ thống.\n"
);

export {};
