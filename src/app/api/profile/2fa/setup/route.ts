import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const payload = await getAuthPayloadFromCookies();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Генерируем секрет
  const secret = speakeasy.generateSecret({
    name: `RP Admin Panel (${payload.username})`,
    length: 20,
  });

  // 2. Сохраняем секрет в базе (но не включаем 2FA пока не подтвердит)
  await prisma.user.update({
    where: { id: payload.userId },
    data: {
      twoFactorSecret: secret.base32,
      twoFactorEnabled: true,
      twoFactorConfirmed: false
    },
  });

  // 3. Генерируем QR как data:image/png;base64
  const qr = await QRCode.toDataURL(secret.otpauth_url!);

  return NextResponse.json({
    qr,
    secret: secret.base32, // если хочешь показывать вручную
  });
}