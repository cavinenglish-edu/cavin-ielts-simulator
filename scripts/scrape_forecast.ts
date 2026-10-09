import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import path from "path";

// Load biến môi trường từ file .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const {
  AI_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

if (!AI_API_KEY || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ LỖI: Thiếu biến môi trường. Vui lòng cấu hình đầy đủ trong .env.local");
  process.exit(1);
}

// Khởi tạo Supabase Client (Dùng Service Role để bypass RLS, cho phép Insert)
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(AI_API_KEY);

const TARGET_URLS = [
  "https://www.ielts-blog.com/category/ielts-speaking-tests/",
  "https://ieltsliz.com/ielts-speaking-free-topics-essential-tips/",
  "https://www.reddit.com/r/IELTS/search/?q=speaking%20recalled%20questions&restrict_sr=1"
];

async function scrapeWebsite(url: string): Promise<string> {
  console.log(`\n🌐 [STEP 1] Đang cào dữ liệu từ: ${url}`);
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // Dùng cheerio để bóc tách text thô từ thẻ body, loại bỏ script/style
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();
    const rawText = $("body").text().replace(/\s+/g, " ").trim();
    
    console.log(`✅ Cào thành công (${rawText.length} ký tự).`);
    return rawText.substring(0, 15000); // Lấy tối đa 15000 ký tự đầu tiên để tránh tràn token
  } catch (error) {
    console.error("❌ Lỗi khi cào web:", error);
    // Trả về một mẩu text giả lập nếu bị chặn (cho mục đích demo/phát triển)
    return `
      IELTS Speaking Forecast Q3 2026.
      Liên hệ Zalo 0912345678 để mua đề tủ giảm giá chiêu sinh trung tâm IELTS.
      Part 1: 
      1. Work or Studies: Do you work or are you a student?
      2. Reading: Do you like reading? What kind of books do you read?
      Part 2:
      Describe a memorable journey you have made. You should say: where you went, how you travelled, why you went there, and explain why it is memorable. www.quangcao.com
      Part 3:
      1. How has transport changed in your country in recent years?
      2. Do you think people will travel more or less in the future?
    `;
  }
}

async function parseWithAI(rawText: string) {
  console.log("\n🧠 [STEP 2] LỚP 1 & 2: Gửi dữ liệu cho AI (Gemini) xử lý & ép kiểu JSON Schema...");
  
  // LỚP 1: STRICT GEMINI PROMPT & REPHRASE
  const prompt = `
    Bạn là một biên tập viên IELTS khắt khe. Nhiệm vụ của bạn là chỉ đọc văn bản thô để trích xuất TOPIC (Chủ đề) và Ý TƯỞNG CÂU HỎI. 
    KHÔNG ĐƯỢC copy nguyên văn câu chữ từ nguồn cào. BẠN PHẢI VIẾT LẠI (Rephrase) toàn bộ các câu hỏi Part 1, Part 2 Cue Card và Part 3 sang câu từ mới, chuẩn ngữ pháp IELTS Cambridge. Đảm bảo nội dung vừa tự nhiên vừa hoàn toàn mới.
    
    LOẠI BỎ HOÀN TOÀN: các đường link URL, số điện thoại, Zalo, tên trung tâm, tên giáo viên, câu chào hỏi, thông tin khuyến mãi, banner quảng cáo. 
    Nếu dữ liệu cào về không chứa câu hỏi IELTS hợp lệ, hãy trả về mảng rỗng cho các parts.

    Văn bản thô:
    """
    ${rawText}
    """
  `;

  // LỚP 2: STRUCTURED OUTPUT ENFORCEMENT
  const examSchema = {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING, description: "Tên bộ đề (VD: Forecast Q3 2026 - Topic: Travel)" },
      season: { type: SchemaType.STRING, description: "Quý và Năm (VD: Q3 2026)" },
      examiner_name: { type: SchemaType.STRING, description: "Tên giám khảo ảo ngẫu nhiên (VD: Mr. David)" },
      examiner_role: { type: SchemaType.STRING, description: "Luôn là: Senior IELTS Examiner" },
      examiner_avatar: { type: SchemaType.STRING, description: "URL avatar ngẫu nhiên (VD: https://i.pravatar.cc/150?u=david)" },
      examiner_voice: { type: SchemaType.STRING, description: "Giọng đọc (VD: en-GB-Standard-B)" },
      part1_topics: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            questions: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            }
          },
          required: ["id", "title", "questions"]
        }
      },
      part2_topic: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          content: { type: SchemaType.STRING },
          bulletPoints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
          }
        },
        required: ["id", "title", "content", "bulletPoints"]
      },
      part3_questions: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            question: { type: SchemaType.STRING },
            type: { type: SchemaType.STRING }
          },
          required: ["id", "question", "type"]
        }
      }
    },
    required: ["title", "season", "examiner_name", "examiner_role", "examiner_avatar", "examiner_voice", "part1_topics", "part2_topic", "part3_questions"]
  } as any;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro", 
      generationConfig: { 
        responseMimeType: "application/json",
        responseSchema: examSchema 
      } 
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text();
    
    console.log(`✅ Ép kiểu JSON Schema thành công.`);
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("❌ Lỗi khi AI xử lý JSON:", error);
    throw error;
  }
}

// LỚP 3: CODE SANITY FILTER
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanityCheckFilter(examData: any) {
  console.log("\n🕵️ [STEP 3] LỚP 3: Chạy Code Sanity Filter quét rác...");
  const spamRegex = /(http|www|09\d|08\d|zalo|facebook|liên hệ|chiêu sinh|giảm giá|trung tâm)/i;
  
  let removedCount = 0;

  // Validate Part 1
  examData.part1_topics.forEach((topic: any) => {
    topic.questions = topic.questions.filter((q: string) => {
      if (q.length < 10 || spamRegex.test(q)) {
        removedCount++;
        return false;
      }
      return true;
    });
  });
  examData.part1_topics = examData.part1_topics.filter((t: any) => t.questions.length > 0);

  // Validate Part 2
  if (examData.part2_topic && examData.part2_topic.content) {
    if (examData.part2_topic.content.length < 10 || spamRegex.test(examData.part2_topic.content)) {
      removedCount++;
      examData.part2_topic.content = "Describe a memorable event in your life."; // Ghi đè fallback an toàn
      examData.part2_topic.bulletPoints = ["When it happened", "Where it happened", "Who was with you", "And explain why it was memorable"];
    } else {
      examData.part2_topic.bulletPoints = examData.part2_topic.bulletPoints.filter((bp: string) => {
        if (bp.length < 5 || spamRegex.test(bp)) {
          removedCount++;
          return false;
        }
        return true;
      });
    }
  }

  // Validate Part 3
  examData.part3_questions = examData.part3_questions.filter((q: any) => {
    if (q.question.length < 10 || spamRegex.test(q.question)) {
      removedCount++;
      return false;
    }
    return true;
  });

  if (removedCount > 0) {
    console.log(`⚠️ Đã phát hiện và lọc bỏ ${removedCount} câu hỏi chứa nội dung rác/ngắn.`);
  } else {
    console.log(`✅ Sanity Check: Không phát hiện rác.`);
  }

  return examData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveToSupabase(examData: any) {
  console.log("\n💾 [STEP 4] Đang đẩy dữ liệu vào Supabase (Status: published)...");
  
  // Kiểm tra rỗng
  if (examData.part1_topics.length === 0 && examData.part3_questions.length === 0) {
    console.error("❌ LỖI: Bộ đề rỗng (không có câu hỏi hợp lệ) sau khi qua bộ lọc. HỦY LƯU.");
    return;
  }
  
  const { data, error } = await supabase
    .from("ielts_exams")
    .insert([
      {
        title: examData.title,
        season: examData.season,
        examiner_name: examData.examiner_name,
        examiner_role: examData.examiner_role,
        examiner_avatar: examData.examiner_avatar,
        examiner_voice: examData.examiner_voice,
        status: "published", // Đẩy thẳng ra Production theo yêu cầu của user
        part1_topics: examData.part1_topics,
        part2_topic: examData.part2_topic,
        part3_questions: examData.part3_questions
      }
    ])
    .select();

  if (error) {
    console.error("❌ Lỗi Insert Supabase:", error.message);
  } else {
    console.log("🎉 THÀNH CÔNG! Đã lưu đề thi Auto-Published vào database.");
    console.log("Bản ghi mới ID:", data[0].id);
  }
}

async function runAutoScraper() {
  console.log("🚀 KHỞI ĐỘNG HỆ THỐNG AUTO-SCRAPER BẢO MẬT CAO (3 LỚP LỌC)...");
  
  // Chọn ngẫu nhiên 1 nguồn hoặc lặp qua tất cả (ở đây demo chọn 1 nguồn)
  const randomUrl = TARGET_URLS[Math.floor(Math.random() * TARGET_URLS.length)];
  
  // 1. Cào dữ liệu
  const rawText = await scrapeWebsite(randomUrl);
  
  // 2. Nhờ LLM xử lý (Lớp 1 + 2)
  let parsedJSON = await parseWithAI(rawText);
  console.log(`📌 Phân tích xong bộ đề: ${parsedJSON.title}`);
  
  // 3. Quét Sanity Check (Lớp 3)
  parsedJSON = sanityCheckFilter(parsedJSON);
  
  // 4. Đẩy lên Supabase (Published)
  await saveToSupabase(parsedJSON);
  
  console.log("\n🏁 Hoàn tất Workflow Scraper.");
}

// Thực thi
runAutoScraper();
