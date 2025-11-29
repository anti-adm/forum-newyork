// src/app/api/profile/avatar/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/jpg") return "jpg";
  return "jpg";
}

async function removeFileIfExists(relativePath: string | null | undefined) {
  if (!relativePath) return;

  try {
    const absolute = path.join(
      process.cwd(),
      "public",
      relativePath.replace(/^\/+/, "")
    );
    await fs.unlink(absolute);
  } catch {
    // файла может не быть — ок
  }
}

export async function POST(req: NextRequest) {
  const payload = await getAuthPayloadFromCookies();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Сначала убеждаемся, что юзер вообще существует
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, avatarUrl: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Пользователь не найден (перелогинься)" },
      { status: 404 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Можно загружать только изображения" },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = getExtension(file.type);
  const fileName = `${user.id}-${randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");

  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, buffer);

  const publicPath = `/uploads/avatars/${fileName}`;

  // удаляем старую аву, если была
  await removeFileIfExists(user.avatarUrl ?? undefined);

  // сохраняем новую в БД
  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: publicPath },
  });

  return NextResponse.json({ avatarUrl: publicPath });
}

export async function DELETE() {
  const payload = await getAuthPayloadFromCookies();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, avatarUrl: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Пользователь не найден (перелогинься)" },
      { status: 404 }
    );
  }

  await removeFileIfExists(user.avatarUrl ?? undefined);

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: null },
  });

  return NextResponse.json({ ok: true });
}