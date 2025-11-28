// src/app/api/superadmin/admins/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";
import { cookies } from "next/headers";
import { logAdminAction } from "@/lib/log";

type AdminTagType =
  | "NONE"
  | "LOG_HUNTER"
  | "CHEAT_HUNTER"
  | "FORUM"
  | "CHIEF"
  | "SENIOR";

function generatePassword(length = 10) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

// GET /api/superadmin/admins
export async function GET() {
  const cookieStore = cookies();
  const payload = await getAuthPayloadFromCookies();

  if (!payload || payload.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const admins = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      isSystem: true,
      adminTag: true,
      avatarUrl: true,
      twoFactorEnabled: true,   // 👈 добавить ЭТО
    },
  });

  return NextResponse.json(admins);
}

// POST /api/superadmin/admins
export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const payload = await getAuthPayloadFromCookies();

  if (!payload || payload.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const body = await req.json();
  const username = String(body.username || "").trim();
  const role = body.role === "SUPERADMIN" ? "SUPERADMIN" : "ADMIN";
  const adminTag: AdminTagType =
    body.adminTag && typeof body.adminTag === "string"
      ? body.adminTag
      : "NONE";

  if (!username) {
    return NextResponse.json(
      { error: "Логин обязателен" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "Пользователь с таким логином уже существует" },
      { status: 400 }
    );
  }

  const password = generatePassword(10);
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role,
      isActive: true,
      isSystem: false,
      adminTag, // 👈 сохраняем тег
    },
  });

  await logAdminAction(
    payload.userId,
    "CREATE_ADMIN",
    `targetId=${admin.id}; username=${admin.username}; role=${role}; tag=${adminTag}`
  );

  return NextResponse.json({
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      isActive: admin.isActive,
      isSystem: admin.isSystem,
      adminTag: admin.adminTag,
    },
    password,
  });
}