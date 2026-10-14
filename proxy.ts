import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { guardRedirect } from "@/lib/exam-sitting";
import { EXAM_COOKIE, verifyExamSession } from "@/lib/exam-session-token";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(EXAM_COOKIE)?.value ?? "";
  const session = verifyExamSession(token, process.env.EXAM_SESSION_SECRET ?? "");
  const target = guardRedirect(session, request.nextUrl.pathname);
  if (target) return NextResponse.redirect(new URL(target, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/exam/check", "/exam/listening", "/exam/reading", "/exam/writing", "/exam/receipt"],
};
