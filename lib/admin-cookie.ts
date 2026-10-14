import "server-only";
import { headers } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export function adminCookieOptions(maxAge = Math.floor(ADMIN_SESSION_TTL_MS / 1000)) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge,
  };
}

function tokenFromCookieHeader(header: string | null): string {
  if (!header) return "";
  const pair = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  if (!pair) return "";
  return decodeURIComponent(pair.slice(ADMIN_COOKIE.length + 1));
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const headerList = await headers();
  const token = tokenFromCookieHeader(headerList.get("cookie"));
  if (!token) return false;
  return verifyAdminSessionToken(token, secret);
}
