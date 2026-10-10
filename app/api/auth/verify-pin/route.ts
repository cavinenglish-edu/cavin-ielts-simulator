import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxofkjj-KJaHM8_vihiQCVFOzAyEBa92oW6Q89fR5NcBqsHkZGiDjGv_ogrBYUihn7Y/exec";

// Helper to evaluate 3-class combo requirement
export function checkStudentCombo(classes: string[]): boolean {
  if (!classes || !Array.isArray(classes)) return false;
  const joined = classes.join(" | ").toUpperCase();
  const hasGrammar = joined.includes("NGỮ PHÁP NÂNG CAO") || joined.includes("NGỮ PHÁP CHUYÊN SÂU");
  const hasSpeaking = joined.includes("NGHE NÓI NÂNG CAO") || joined.includes("NGHE NÓI CHUYÊN SÂU");
  const hasWriting = joined.includes("ĐỌC VIẾT IELTS");
  return hasGrammar && hasSpeaking && hasWriting;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPin = body.pin ? String(body.pin).trim() : "";
    const rawPhone = body.phone ? String(body.phone).trim().replace(/\D/g, "") : "";

    const pin = rawPin.replace(/\D/g, "");

    if (!pin) {
      return NextResponse.json(
        { status: "ERROR", message: "Vui lòng nhập Mã PIN bảo mật!" },
        { status: 400 }
      );
    }

    if (pin.length !== 4 && pin.length !== 6) {
      return NextResponse.json(
        { 
          status: "ERROR", 
          message: "Mã PIN không hợp lệ! Vui lòng nhập mã PIN 4 số (Học sinh trung tâm) hoặc mã PIN 6 số (Khách online)." 
        },
        { status: 400 }
      );
    }

    // 1. Query Supabase cached table first (instant response)
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      let query = supabase.from("exam_auth_pins").select("*").eq("pin", pin);
      if (rawPhone) {
        query = query.eq("phone", rawPhone);
      }
      
      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        // Found record in Supabase
        if (data.user_type === "online") {
          return NextResponse.json({
            status: "SUCCESS",
            type: "online",
            candidate: {
              name: data.student_name || "Thí sinh tự do",
              engName: data.eng_name || "Online Candidate",
              phone: data.phone,
              email: data.email,
              pin: data.pin,
              userType: "online",
              classes: data.classes || ["Khách Online VIP"],
              packageType: data.package_type || "VIP",
              expiry: data.expiry,
              isQualified: true
            }
          });
        }

        // Student Type (Danh Sách Gốc)
        const isQualified = checkStudentCombo(data.classes || []);
        if (isQualified) {
          return NextResponse.json({
            status: "SUCCESS",
            type: "student",
            candidate: {
              name: data.student_name,
              engName: data.eng_name,
              phone: data.phone,
              pin: data.pin,
              userType: "student",
              classes: data.classes,
              isQualified: true
            }
          });
        } else {
          return NextResponse.json({
            status: "NOT_QUALIFIED",
            type: "student",
            message: `Học sinh ${data.student_name} hiện đang đăng ký ${data.classes?.length || 0} lớp: [${(data.classes || []).join(", ")}].`,
            detail: "Hệ thống phòng thi thử IELTS 4 kỹ năng Chuẩn Khảo Thí Quốc Tế là ĐẶC QUYỀN VIP dành riêng cho học sinh đăng ký trọn bộ 3 lớp: Ngữ Pháp (Nâng Cao/Chuyên Sâu) + Nghe Nói (Nâng Cao/Chuyên Sâu) + Đọc Viết IELTS.",
            candidate: {
              name: data.student_name,
              engName: data.eng_name,
              phone: data.phone,
              pin: data.pin,
              userType: "student",
              classes: data.classes,
              isQualified: false
            }
          });
        }
      }
    }

    // 2. Fallback to Google Apps Script Web App if phone provided
    if (rawPhone) {
      try {
        const res = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "check_login", phone: rawPhone, pin }),
        });
        const gasData = await res.json();

        if (gasData && gasData.status === "success") {
          const classes = gasData.activeClasses || [gasData.className];
          const isQualified = checkStudentCombo(classes);

          // Upsert to Supabase
          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            await supabase.from("exam_auth_pins").upsert({
              pin,
              student_name: gasData.studentName,
              eng_name: gasData.engName || "",
              phone: rawPhone,
              user_type: "student",
              classes,
              is_qualified: isQualified,
            }, { onConflict: "pin" });
          }

          if (isQualified) {
            return NextResponse.json({
              status: "SUCCESS",
              type: "student",
              candidate: {
                name: gasData.studentName,
                engName: gasData.engName || "",
                phone: rawPhone,
                pin,
                userType: "student",
                classes,
                isQualified: true
              }
            });
          } else {
            return NextResponse.json({
              status: "NOT_QUALIFIED",
              type: "student",
              message: `Học sinh ${gasData.studentName} hiện đang đăng ký ${classes.length} lớp: [${classes.join(", ")}].`,
              detail: "Hệ thống phòng thi thử IELTS 4 kỹ năng Chuẩn Khảo Thí Quốc Tế là ĐẶC QUYỀN VIP dành riêng cho học sinh đăng ký trọn bộ 3 lớp: Ngữ Pháp (Nâng Cao/Chuyên Sâu) + Nghe Nói (Nâng Cao/Chuyên Sâu) + Đọc Viết IELTS.",
              candidate: {
                name: gasData.studentName,
                engName: gasData.engName || "",
                phone: rawPhone,
                pin,
                userType: "student",
                classes,
                isQualified: false
              }
            });
          }
        }
      } catch (err) {
        console.error("Apps Script fallback error:", err);
      }
    }

    // 3. Not found
    return NextResponse.json({
      status: "NOT_FOUND",
      message: "Mã PIN bảo mật không chính xác hoặc chưa được kích hoạt trên hệ thống dữ liệu của Cavin's English.",
      detail: "Vui lòng kiểm tra lại mã PIN 4 số (Học sinh trung tâm) hoặc mã PIN 6 số (Khách kích hoạt Online). Nếu bạn cần hỗ trợ, vui lòng liên hệ Admin / Thầy Cavin qua Zalo."
    }, { status: 404 });

  } catch (error) {
    console.error("API verify-pin error:", error);
    return NextResponse.json(
      { status: "ERROR", message: "Đã xảy ra lỗi hệ thống khi xác thực mã PIN. Vui lòng thử lại sau ít phút!" },
      { status: 500 }
    );
  }
}
