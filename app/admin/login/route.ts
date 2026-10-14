import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminSessionToken, isRateLimited, passwordsMatch, recordFailure } from "@/lib/admin-session";
import { adminCookieOptions } from "@/lib/admin-cookie";

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
  const password = String(form.get("password") ?? "");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  if (isRateLimited(loginFailures, ip, now)) {
    return NextResponse.redirect(adminUrl(request, "rate"), 303);
  }
  if (!password) {
    return NextResponse.redirect(adminUrl(request, "empty"), 303);
  }
  if (!passwordsMatch(password, secret)) {
    recordFailure(loginFailures, ip, now);
    return NextResponse.redirect(adminUrl(request, "password"), 303);
  }

  const response = NextResponse.redirect(adminUrl(request), 303);
  response.cookies.set(ADMIN_COOKIE, createAdminSessionToken(secret), adminCookieOptions());
  return response;
}
