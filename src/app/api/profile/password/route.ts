// src/app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const payload = await getAuthPayloadFromCookies();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    !currentPassword.trim() ||
    !newPassword.trim()
  ) {
    return NextResponse.json(
      { error: "Заполните все поля" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Новый пароль должен быть не короче 8 символов" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { passwordHash: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    return NextResponse.json(
      { error: "Текущий пароль указан неверно" },
      { status: 400 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: payload.userId },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ ok: true });
}