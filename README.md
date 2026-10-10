# Cavin's English - IELTS Computer-Delivered Simulator 1:1

Hệ thống thi thử IELTS Speaking 1:1 mô phỏng chính xác áp lực phòng thi thực tế chuẩn khảo thí quốc tế (IDP & British Council), tích hợp Giám khảo AI bản xứ, đồng hồ phản xạ Part 1/2/3 và bộ máy chấm chữa phân tích 4 tiêu chí chuyên sâu.

- **Website Production:** [https://ielts.cavinenglish2edu.com](https://ielts.cavinenglish2edu.com)
- **Hệ thống chính:** [https://cavinenglish2edu.com](https://cavinenglish2edu.com)
- **GitHub Repository:** [https://github.com/cavinenglish-edu/cavin-ielts-simulator](https://github.com/cavinenglish-edu/cavin-ielts-simulator)

---

## 🚀 Hướng Dẫn Thiết Lập Trên Máy Mới (Desktop)

### 1. Clone repository về máy
```bash
git clone https://github.com/cavinenglish-edu/cavin-ielts-simulator.git
cd cavin-ielts-simulator
```

### 2. Cài đặt thư viện dependencies
```bash
npm install
```

### 3. Cấu hình biến môi trường (`.env.local`)
Tạo file `.env.local` ở thư mục gốc của dự án với nội dung:
```env
NEXT_PUBLIC_SUPABASE_URL="https://httzzrkhvxnkqhbzlefz.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dHp6cmtodnhua3FoYnpsZWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDEwMzgsImV4cCI6MjEwNzExNzAzOH0.3p7XSmT0f7Neu5JolfwNJAHDnlgeejA8xTZLA5Fqz60"
```

### 4. Khởi chạy môi trường phát triển (Local Development)
```bash
npm run dev
```
Mở trình duyệt truy cập: [http://localhost:3000](http://localhost:3000)

### 5. Cào đề thi thật & Forecast tự động lên Database
Nếu muốn chạy tool cào và tổng hợp ngân hàng đề thi AI lên Supabase:
```bash
npx ts-node scripts/scrape_forecast.ts
```

---

## 🛠️ Công Nghệ Lõi (Tech Stack)
- **Framework:** Next.js 16 (Turbopack) & React 19
- **Ngôn ngữ:** TypeScript (Strict typing)
- **Styling:** Tailwind CSS
- **Database & Realtime:** Supabase PostgreSQL
- **AI Core:** Google Gemini & OpenAI Audio APIs
- **Deploy & CI/CD:** Vercel (Auto Deploy từ nhánh `master`)
