import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";
import speakeasy from "speakeasy";

export async function POST(req: NextRequest) {
  const payload = await getAuthPayloadFromCookies();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Введите код" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { twoFactorSecret: true },
  });

  if (!user?.twoFactorSecret) {
    return NextResponse.json({ error: "2FA не было запущено" }, { status: 400 });
  }

  const ok = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token: code,
    window: 1,
  });

  if (!ok) {
    return NextResponse.json({ error: "Неверный код" }, { status: 400 });
  }

  // Подтверждаем
  await prisma.user.update({
    where: { id: payload.userId },
    data: { twoFactorConfirmed: true },
  });

  return NextResponse.json({ ok: true });
}