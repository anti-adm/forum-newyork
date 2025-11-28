// src/lib/auth/trusted2fa.ts
import type { NextRequest, NextResponse } from "next/server";
import { sign, verify } from "@/lib/auth/jwt";

export const TRUSTED_COOKIE_NAME = "trusted_2fa";

type TrustedPayload = {
  userId: number;
  exp: number; // timestamp (ms)
};

// читаем "доверенное устройство" из куки (используется при логине)
export function parseTrustedCookie(req: NextRequest): TrustedPayload | null {
  const raw = req.cookies.get(TRUSTED_COOKIE_NAME)?.value;
  if (!raw) return null;

  const payload = verify<TrustedPayload>(raw);
  if (!payload) return null;
  if (payload.exp < Date.now()) return null;

  return payload;
}

// ставим куку "доверенное устройство" на 30 дней (используется при 2fa-verify)
export function setTrustedCookie(res: NextResponse, userId: number) {
  const payload: TrustedPayload = {
    userId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 дней
  };

  const token = sign(payload);

  res.cookies.set(TRUSTED_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
}

// очищаем trusted-куку на ответе
export function clearTrustedCookie(res: NextResponse) {
  res.cookies.set(TRUSTED_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

// удобный алиас, если хочется "удалить"
export function deleteTrustedCookie(res: NextResponse) {
  clearTrustedCookie(res);
}