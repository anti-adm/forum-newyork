import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";

export async function POST(req: Request) {
  const payload = await getAuthPayloadFromCookies();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let forumNick: string | null =
    typeof body.forumNick === "string" ? body.forumNick.trim() : null;

  // пустую строку считаем как "убрать ник"
  if (!forumNick || forumNick.length === 0) {
    forumNick = null;
  }

  // ограничим длину
  if (forumNick && forumNick.length > 64) {
    forumNick = forumNick.slice(0, 64);
  }

  try {
    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: { forumNick },
      select: { forumNick: true },
    });

    return NextResponse.json({ forumNick: user.forumNick });
  } catch (e) {
    console.error("[forum-nick] Failed to update forumNick:", e);
    return NextResponse.json(
      { error: "Не удалось сохранить форумный ник" },
      { status: 500 }
    );
  }
}