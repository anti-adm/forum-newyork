// src/app/api/profile/2fa/disable/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";
import { deleteTrustedCookie } from "@/lib/auth/trusted2fa";

export async function POST(req: NextRequest) {
  const payload = await getAuthPayloadFromCookies();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // выключаем 2FA у пользователя
  await prisma.user.update({
    where: { id: payload.userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorConfirmed: false,
    },
  });

  // формируем ответ и одновременно чистим trusted-куку
  const res = NextResponse.json({ ok: true });
  deleteTrustedCookie(res);

  return res;
}