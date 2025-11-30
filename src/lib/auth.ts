// src/lib/auth.ts
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // 👈 ДОБАВИЛИ

export type AuthRole = "ADMIN" | "SUPERADMIN";

export interface AuthPayload {
  userId: number;
  username: string;
  role: AuthRole;
  avatarUrl?: string | null;
  adminTag: string;
}

const TOKEN_COOKIE_NAME = "auth_token";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRES_IN = "7d";

export function createToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: NextResponse, payload: AuthPayload) {
  const token = createToken(payload);
  res.cookies.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// 👇 теперь проверяем, что пользователь ещё существует и активен
export async function getAuthPayloadFromCookies(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  // проверяем в базе
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    // пользователь удалён или отключён — считаем, что он не авторизован
    return null;
  }

  return payload;
}