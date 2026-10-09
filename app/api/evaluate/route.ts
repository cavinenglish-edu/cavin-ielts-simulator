import { NextResponse } from "next/server";
import { ExamSubmission, ExamAnswer } from "@/types";

export async function POST(req: Request) {
  try {
    const body: ExamSubmission = await req.json();
    const { answers, candidate } = body;

    // Simulate AI processing delay (3 seconds) to emulate deep evaluation
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Calculate simulated word count and duration to determine scores
    let totalWords = 0;
    let totalDuration = 0;
    
    answers.forEach((ans: ExamAnswer) => {
      totalWords += ans.transcript ? ans.transcript.split(/\s+/).length : 0;
      totalDuration += ans.durationSeconds || 0;
    });

    const wpm = totalDuration > 0 ? (totalWords / (totalDuration / 60)) : 0;
    
    // Simple heuristic for demo scoring based on target band
    const target = candidate?.target ? parseFloat(candidate.target) : 6.5;
    
    // Emulate realistic slightly fluctuated scores
    let fc = target;
    let lr = target - 0.5;
    let gra = target;
    let p = target + 0.5;
    
    if (wpm < 100) fc = Math.max(5.0, target - 1.0);
    if (wpm > 150) fc = Math.min(9.0, target + 0.5);

    // Round to nearest 0.5
    fc = Math.round(fc * 2) / 2;
    lr = Math.round(lr * 2) / 2;
    gra = Math.round(gra * 2) / 2;
    p = Math.round(p * 2) / 2;

    const overall = Math.round(((fc + lr + gra + p) / 4) * 2) / 2;

    const evaluationResult = {
      overall,
      criteria: {
        fc: {
          score: fc,
          title: "Fluency and Coherence",
          comments: wpm > 120 
            ? "Thí sinh duy trì tốc độ nói rất tốt, ít vấp váp. Các ý tưởng được liên kết logic, mạch lạc."
            : "Tốc độ nói đôi chỗ ngập ngừng, cần cải thiện khả năng duy trì dòng suy nghĩ tự nhiên hơn.",
        },
        lr: {
          score: lr,
          title: "Lexical Resource",
          comments: "Vốn từ vựng tương đối phong phú. Cần sử dụng thêm các cụm từ (collocations) và thành ngữ (idioms) tự nhiên hơn.",
        },
        gra: {
          score: gra,
          title: "Grammatical Range and Accuracy",
          comments: "Cấu trúc ngữ pháp khá đa dạng. Tuy nhiên, vẫn còn một số lỗi nhỏ liên quan đến mạo từ và thì quá khứ đơn.",
        },
        p: {
          score: p,
          title: "Pronunciation",
          comments: "Phát âm rõ ràng, dễ hiểu. Ngữ điệu (intonation) và trọng âm câu (sentence stress) tự nhiên, mang phong thái bản xứ.",
        },
      },
      detailedFeedback: answers.map((ans: ExamAnswer, index: number) => ({
        id: index,
        part: ans.part,
        question: ans.questionText,
        originalTranscript: ans.transcript || "(Không có dữ liệu âm thanh)",
        suggestedVocabulary: ["game-changer", "unforeseen circumstances", "foster resilience"],
        improvedAnswer: `(Suggested Band 8.0+) While I am generally a planner, occasionally embracing unexpected changes can be a real game-changer. For instance, dealing with unforeseen circumstances not only fosters resilience but also leads to the most memorable adventures.`,
        grammarFixes: "Lưu ý sử dụng thì Hiện tại hoàn thành (Present Perfect) thay vì Quá khứ đơn khi mô tả một trải nghiệm kéo dài đến hiện tại.",
      })),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(evaluationResult);
  } catch (error) {
    console.error("Evaluation API Error:", error);
    return NextResponse.json({ error: "Failed to evaluate" }, { status: 500 });
  }
}
