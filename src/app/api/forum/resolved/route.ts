import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const BOT_TOKEN = process.env.FORUM_BOT_TOKEN;

// ====== SCHEMAS ======

const punishmentSchema = z.object({
  type: z.enum(["ajail", "mute", "warn", "ban", "hardban", "gunban"]),
  staticId: z.string().regex(/^\d+$/),
  duration: z.number().int().nonnegative().nullable(),
  unit: z.enum(["minutes", "hours", "days"]).nullable(),
  command: z.string(),
});

const payloadSchema = z.object({
  adminForumName: z.string().min(1),
  threadId: z.number().int(),
  threadUrl: z.string().url(),
  threadTitle: z.string().min(1),
  punishments: z.array(punishmentSchema),
});

// ====== HANDLER ======

export async function POST(req: Request) {
  // 1) проверяем токен бота
  if (!BOT_TOKEN) {
    console.error("[forum/resolved] FORUM_BOT_TOKEN not set in env");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const headerToken = req.headers.get("x-forum-bot-token");
  if (!headerToken || headerToken !== BOT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) читаем body
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    console.error(
      "[forum/resolved] Bad payload:",
      parsed.error.flatten()
    );
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const { adminForumName, threadId, threadUrl, threadTitle, punishments } =
    parsed.data;

  // 3) ищем админа по forumNick
  const admin = await prisma.user.findFirst({
    where: { forumNick: adminForumName },
    select: { id: true, username: true },
  });

  if (!admin) {
    console.warn(
      `[forum/resolved] Admin with forumNick="${adminForumName}" not found`
    );
    return NextResponse.json(
      { error: `Admin with forumNick "${adminForumName}" not found` },
      { status: 404 }
    );
  }

  // 4) сохраняем наказания
  const createdIds: number[] = [];

  for (const p of punishments) {
    const row = await prisma.punishment.create({
      data: {
        adminId: admin.id,
        type: p.type,
        staticId: parseInt(p.staticId, 10),
        duration: p.duration ?? 0,
        // будем хранить именно тип ед. измерения — minutes/hours/days/NONE
        durationUnit: p.unit ? p.unit.toUpperCase() : "NONE",
        complaintCode: threadTitle,
        command: p.command,
      },
    });

    createdIds.push(row.id);
  }

  return NextResponse.json({
    ok: true,
    adminId: admin.id,
    adminUsername: admin.username,
    threadId,
    threadUrl,
    threadTitle,
    createdCount: createdIds.length,
    createdIds,
  });
}