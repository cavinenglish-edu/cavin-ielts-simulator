import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-session";
import { adminCookieOptions } from "@/lib/admin-cookie";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(ADMIN_COOKIE, "", adminCookieOptions(0));
  return response;
}
