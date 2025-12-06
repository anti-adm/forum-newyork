// src/app/api/punishments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";
import { logAdminAction } from "@/lib/log";

type PunishmentType = "ajail" | "mute" | "warn" | "ban" | "hardban" | "gunban";

function buildCommand(
  type: PunishmentType,
  staticId: number,
  duration: number,
  complaintCode: string
): string {
  const c = complaintCode ? `Жалоба ${complaintCode}` : "";
  switch (type) {
    case "ajail":
      return `/ajail ${staticId} ${duration} ${c}`.trim();
    case "mute":
      return `/mute ${staticId} ${duration} ${c}`.trim();
    case "warn":
      return `/warn ${staticId} ${c}`.trim();
    case "ban":
      return `/ban ${staticId} ${duration} ${c}`.trim();
    case "hardban":
      return `/hardban ${staticId} ${duration} ${c}`.trim();
    case "gunban":
      return `/gunban ${staticId} ${duration} ${c}`.trim();
    default:
      return `/warn ${staticId} ${c}`.trim();
  }
}

export async function GET(req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const adminIdParam = searchParams.get("adminId");

  let adminId = auth.userId;
  if (auth.role === "SUPERADMIN" && adminIdParam) {
    const parsed = Number(adminIdParam);
    if (!Number.isNaN(parsed)) {
      adminId = parsed;
    }
  }

  const [user, punishments] = await Promise.all([
    prisma.user.findUnique({ where: { id: adminId } }),
    prisma.punishment.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // команды только по НЕ выданным наказаниям
  const commands = (punishments || [])
    .filter((p) => !p.issued && p.command)
    .map((p) => p.command as string);

  return NextResponse.json({
    punishments,
    lastComplaintCode: user?.lastComplaintCode ?? null,
    commands,
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, staticId, duration, complaintCode, issued } = body as {
    type?: string;
    staticId?: string | number;
    duration?: string | number;
    complaintCode?: string;
    issued?: boolean;
  };

  const normalizedComplaintCode = (complaintCode ?? "").trim().toUpperCase();

  if (!type || !staticId || !normalizedComplaintCode) {
    return NextResponse.json(
      { error: "Заполните тип, staticId и код жалобы" },
      { status: 400 }
    );
  }

  const validTypes: PunishmentType[] = [
    "ajail",
    "mute",
    "warn",
    "ban",
    "hardban",
    "gunban",
  ];
  if (!validTypes.includes(type as PunishmentType)) {
    return NextResponse.json(
      { error: "Недопустимый тип наказания" },
      { status: 400 }
    );
  }

  const parsedStaticId = Number(staticId);
  if (!Number.isInteger(parsedStaticId) || parsedStaticId <= 0) {
    return NextResponse.json(
      { error: "staticId должен быть положительным числом" },
      { status: 400 }
    );
  }

  let finalDuration = 0;
  let durationUnit = "NONE";
  if (type !== "warn") {
    const d = Number(duration);
    if (!Number.isInteger(d) || d <= 0) {
      return NextResponse.json(
        { error: "Продолжительность должна быть положительным числом" },
        { status: 400 }
      );
    }
    finalDuration = d;
    durationUnit = "MINUTES";
  }

  const command = buildCommand(
    type as PunishmentType,
    parsedStaticId,
    finalDuration,
    normalizedComplaintCode
  );

  const punishment = await prisma.punishment.create({
    data: {
      adminId: auth.userId,
      type,
      staticId: parsedStaticId,
      duration: finalDuration,
      durationUnit,
      complaintCode: normalizedComplaintCode,
      issued: Boolean(issued),
      command,
    },
  });

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      lastComplaintCode: normalizedComplaintCode,
      lastComplaintUpdatedAt: new Date(),
    },
  });

  await logAdminAction(
    auth.userId,
    "CREATE_PUNISHMENT",
    `punishmentId=${punishment.id}; type=${type}; staticId=${parsedStaticId}`
  );

  return NextResponse.json({ punishment, command });
}

// ОЧИСТКА СПИСКА КОМАНД: пометить ВСЕ невыданные наказания как issued
export async function DELETE() {
  const auth = await getAuthPayloadFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.punishment.updateMany({
    where: { adminId: auth.userId, issued: false },
    data: { issued: true },
  });

  return NextResponse.json({ updated: result.count });
}