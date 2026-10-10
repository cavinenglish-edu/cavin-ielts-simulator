# Thiết kế Hệ thống Thi Giả Lập HSA - Chuyên đề Tiếng Anh (HSA English Simulator)

Tài liệu này ghi nhận định hướng kiến trúc, lộ trình phát triển và mô hình dữ liệu cho module thi giả lập **Đánh giá năng lực ĐHQGHN (HSA) - Phần thi Tiếng Anh**, chuẩn bị cho việc tiếp tục phát triển trên môi trường Desktop.

---

## 1. Mục tiêu & Định vị Sản phẩm
* **Mục tiêu**: Xây dựng phòng thi giả lập chuẩn hóa bài thi Tiếng Anh ĐGNL HSA với trải nghiệm thực chiến cao, chống mất bài khi làm bài, chấm điểm và phân tích lỗ hổng kiến thức chuyên sâu.
* **Đối tượng**: Thí sinh ôn thi ĐGNL ĐHQGHN (HSA).
* **Trọng tâm**: Tối ưu UX/UI cho các dạng bài đặc thù của Tiếng Anh (đặc biệt là bài đọc hiểu chia màn hình, câu hỏi ngữ âm, gạch chân tìm lỗi sai, và điền từ vào đoạn văn).

---

## 2. Đặc thù & Cấu trúc Dạng bài Tiếng Anh HSA
1. **Dạng câu hỏi đơn (Standalone Questions)**:
   * **Ngữ âm (Phonetics)**: Phát âm (Pronunciation) & Trọng âm (Stress).
   * **Ngữ pháp & Từ vựng (Vocabulary & Grammar)**: Thì, mệnh đề quan hệ, từ loại, giới từ, cụm từ cố định (collocations/idioms), giao tiếp xã hội.
   * **Tìm lỗi sai (Error Identification)**: 4 phần gạch chân gán nhãn A, B, C, D trong 1 câu văn.
   * **Viết lại câu & Kết hợp câu (Sentence Transformation & Combination)**: Chọn câu đồng nghĩa hoặc kết hợp 2 câu đơn thành câu phức/ghép.
2. **Dạng câu hỏi chùm (Passage-based Questions)**:
   * **Điền từ vào đoạn văn (Cloze Test)**: Đoạn văn có 5-10 chỗ trống tương ứng với các câu hỏi con.
   * **Đọc hiểu (Reading Comprehension)**: 1-2 bài đọc dài kèm 5-10 câu hỏi theo từng bài (main idea, detail, inference, vocabulary in context).

---

## 3. Kiến trúc Trải nghiệm Phòng thi (Exam Engine)
* **Split-pane View (Chia đôi màn hình cho phần Đọc hiểu)**:
  * Bên trái: Văn bản bài đọc với thanh cuộn độc lập, hỗ trợ highlight / đánh dấu dẫn chứng.
  * Bên phải: Danh sách câu hỏi trắc nghiệm và các lựa chọn đáp án A, B, C, D.
* **Question Palette (Bảng điều hướng câu hỏi)**:
  * Trạng thái trực quan: Chưa làm (trắng/xám), Đã chọn đáp án (xanh lá), Gắn cờ xem lại - Flag (vàng/cam).
* **Fail-safe & Auto-save Realtime**:
  * Lưu trữ ngay lập tức trạng thái từng câu vào `localStorage`.
  * Đồng bộ định kỳ (debounce) với Backend để khôi phục bài làm nguyên vẹn khi xảy ra sự cố F5 hoặc rớt mạng.
* **Timer**: Bộ đếm ngược thời gian chính xác, tự động khóa đề và nộp bài khi hết giờ.

---

## 4. Hệ thống Chấm điểm & Đánh giá Năng lực (Analytics)
* **Bóc tách kỹ năng (Skill Radar / Breakdown)**:
  * Ngữ âm (Pronunciation / Stress)
  * Ngữ pháp & Cấu trúc câu (Grammar & Syntax)
  * Từ vựng & Cụm từ (Lexical resource)
  * Đọc hiểu & Phân tích văn bản (Reading Comprehension)
* **Lời giải chi tiết**:
  * Hiển thị đáp án đúng kèm lý do, cấu trúc ngữ pháp cần nhớ, dịch nghĩa câu/đoạn.
  * Highlight dòng dẫn chứng trực tiếp trong bài đọc đối với câu đọc hiểu.

---

## 5. Kế hoạch triển khai tiếp theo (Desktop Next Steps)
1. Khảo sát trực tiếp cấu trúc đề thực tế qua đường link/tài liệu bài thi mẫu.
2. Xây dựng Data Schema cho Question Bank (hỗ trợ cả standalone và passage-based questions).
3. Tái sử dụng và nâng cấp Exam Engine từ hệ thống hiện có (`app/exam/room`) để hỗ trợ layout Split-view chuẩn cho HSA Tiếng Anh.
4. Xây dựng bộ công cụ Import đề thi từ JSON / Markdown / docx.
