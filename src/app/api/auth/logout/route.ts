// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // сносим JWT-куку
  clearAuthCookie(res);

  return res;
}