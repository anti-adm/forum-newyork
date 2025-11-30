// src/app/api/superadmin/admins/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";
import { logAdminAction } from "@/lib/log";

type AdminTagType =
  | "NONE"
  | "LOG_HUNTER"
  | "CHEAT_HUNTER"
  | "FORUM"
  | "CHIEF_CURATOR"
  | "SENIOR"
  | "CHIEF_ADMINISTRATOR"
  | "DEPUTY_CHIEF"
  | "DEVELOPER";

const ALLOWED_TAGS: AdminTagType[] = [
  "NONE",
  "LOG_HUNTER",
  "CHEAT_HUNTER",
  "FORUM",
  "CHIEF_CURATOR",
  "SENIOR",
  "CHIEF_ADMINISTRATOR",
  "DEPUTY_CHIEF",
  "DEVELOPER",
];

type AdminRole = "ADMIN" | "SUPERADMIN";

export async function GET() {
  const auth = await getAuthPayloadFromCookies();
  if (!auth || auth.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admins = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "SUPERADMIN"] },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      isSystem: true,
      adminTag: true,
      avatarUrl: true,
      twoFactorEnabled: true,
    },
  });

  return NextResponse.json(admins);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth || auth.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const usernameRaw: string | undefined = body.username;
  const roleRaw: string | undefined = body.role;
  const adminTagRaw: string | undefined = body.adminTag;

  const username = usernameRaw?.trim();
  if (!username) {
    return NextResponse.json(
      { error: "Укажи логин администратора" },
      { status: 400 }
    );
  }

  const role: AdminRole =
    roleRaw === "SUPERADMIN" ? "SUPERADMIN" : "ADMIN";

  const adminTag: AdminTagType =
    (ALLOWED_TAGS.includes(adminTagRaw as AdminTagType)
      ? (adminTagRaw as AdminTagType)
      : "NONE");

  // случайный пароль
  const plainPassword =
    "adm" +
    Math.random().toString(36).slice(2, 6) +
    Math.floor(10 + Math.random() * 89);

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  try {
    const created = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
        isActive: true,
        isSystem: false,
        adminTag,
      },
    });

    await logAdminAction(
      auth.userId,
      "CREATE_ADMIN",
      `createdId=${created.id}; username=${created.username}; role=${created.role}; tag=${created.adminTag}`
    );

    return NextResponse.json({
      admin: {
        id: created.id,
        username: created.username,
        role: created.role,
        isActive: created.isActive,
        isSystem: created.isSystem,
        adminTag: created.adminTag,
        avatarUrl: created.avatarUrl,
        twoFactorEnabled: created.twoFactorEnabled,
      },
      password: plainPassword,
    });
  } catch (err: any) {
    console.error(err);
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Админ с таким логином уже существует" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Ошибка при создании администратора" },
      { status: 500 }
    );
  }
}