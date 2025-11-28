import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, type AuthPayload } from "@/lib/auth";
import { sign } from "@/lib/auth/jwt";
import { parseTrustedCookie } from "@/lib/auth/trusted2fa";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: "Укажите логин и пароль" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      role: true,
      isActive: true,
      avatarUrl: true,
      adminTag: true,
      twoFactorEnabled: true,
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json(
      { error: "Неверный логин или пароль" },
      { status: 401 }
    );
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Неверный логин или пароль" },
      { status: 401 }
    );
  }

  // ---------- 2FA ----------
  if (user.twoFactorEnabled) {
    // если устройство уже доверенное — обычный вход
    const trusted = parseTrustedCookie(req);
    if (trusted && trusted.userId === user.id) {
      const payload: AuthPayload = {
        userId: user.id,
        username: user.username,
        role: user.role as AuthPayload["role"],
        avatarUrl: user.avatarUrl ?? null,
        adminTag: user.adminTag as AuthPayload["adminTag"],
      };

      const res = NextResponse.json({ ok: true, skip2fa: true });
      setAuthCookie(res, payload);
      return res;
    }

    // иначе выдаём временный токен для шага 2FA
    const tempToken = sign({
      userId: user.id,
      step: "2fa",
      exp: Date.now() + 5 * 60 * 1000, // 5 минут
    });

    return NextResponse.json(
      { needs2fa: true, tempToken },
      { status: 200 }
    );
  }
  // ---------- /2FA ----------

  // обычный вход без 2FA
  const payload: AuthPayload = {
    userId: user.id,
    username: user.username,
    role: user.role as AuthPayload["role"],
    avatarUrl: user.avatarUrl ?? null,
    adminTag: user.adminTag as AuthPayload["adminTag"],
  };

  const res = NextResponse.json({ ok: true });
  setAuthCookie(res, payload);
  return res;
}