import { NextResponse } from "next/server";
import { publicSession, readSession } from "@/lib/sitting-cookie";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Chưa có phiên thi." }, { status: 401 });
  return NextResponse.json({ session: publicSession(session) });
}
