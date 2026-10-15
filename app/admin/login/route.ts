import { NextResponse } from "next/server";
import { adminCookieOptions } from "@/lib/admin-cookie";
import { loginErrorCode, verifyAdminPhonePin } from "@/lib/admin-roster";
import { ADMIN_COOKIE, createAdminSessionToken, isRateLimited, recordFailure } from "@/lib/admin-session";

const loginFailures = new Map<string, number[]>();

function adminUrl(request: Request, error?: string): URL {
  const url = new URL("/admin", request.url);
  if (error) url.searchParams.set("error", error);
  return url;
}

export async function POST(request: Request) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    return NextResponse.redirect(adminUrl(request, "config"), 303);
  }

  const form = await request.formData();
  const phone = String(form.get("phone") ?? "");
  const pin = String(form.get("pin") ?? "");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  if (isRateLimited(loginFailures, ip, now)) {
    return NextResponse.redirect(adminUrl(request, "rate"), 303);
  }

  const result = await verifyAdminPhonePin(phone, pin);
  if (!result.ok) {
    if (result.reason === "mismatch") recordFailure(loginFailures, ip, now);
    return NextResponse.redirect(adminUrl(request, loginErrorCode(result.reason)), 303);
  }

  const response = NextResponse.redirect(adminUrl(request), 303);
  response.cookies.set(ADMIN_COOKIE, createAdminSessionToken(secret), adminCookieOptions());
  return response;
}
