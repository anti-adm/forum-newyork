import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { prisma } from "@/lib/prisma";
import { verify } from "@/lib/auth/jwt";
import { setAuthCookie, type AuthPayload } from "@/lib/auth";
import { setTrustedCookie } from "@/lib/auth/trusted2fa";

type Temp2faPayload = {
  userId: number;
  step: "2fa";
  exp: number;
};

export async function POST(req: NextRequest) {
  const { token, code, trustDevice } = await req.json();

  if (!token || !code) {
    return NextResponse.json(
      { error: "Отсутствуют код или токен" },
      { status: 400 }
    );
  }

  const temp = verify<Temp2faPayload>(token);
  if (!temp || temp.step !== "2fa" || temp.exp < Date.now()) {
    return NextResponse.json(
      { error: "Временный токен истёк или неверен" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: temp.userId },
    select: {
      id: true,
      username: true,
      role: true,
      avatarUrl: true,
      adminTag: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorConfirmed: true,
    },
  });

  if (
    !user ||
    !user.twoFactorEnabled ||
    !user.twoFactorSecret ||
    !user.twoFactorConfirmed
  ) {
    return NextResponse.json(
      { error: "2FA не настроена для этого пользователя" },
      { status: 400 }
    );
  }

  const ok = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token: code,
    window: 1,
  });

  if (!ok) {
    return NextResponse.json(
      { error: "Неверный код 2FA" },
      { status: 400 }
    );
  }

  const payload: AuthPayload = {
    userId: user.id,
    username: user.username,
    role: user.role as AuthPayload["role"],
    avatarUrl: user.avatarUrl ?? null,
    adminTag: user.adminTag as AuthPayload["adminTag"],
  };

  const res = NextResponse.json({ ok: true });

  // основная auth-кука
  setAuthCookie(res, payload);

  // «доверенное устройство» на 30 дней
  if (trustDevice) {
    setTrustedCookie(res, user.id);
  }

  return res;
}