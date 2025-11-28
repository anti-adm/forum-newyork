// src/app/api/profile/avatar/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

function getExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
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
    // игнорируем, если файла нет
  }
}

export async function POST(req: NextRequest) {
  const payload = await getAuthPayloadFromCookies();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Можно загружать только изображения" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = getExtension(file.type);
  const fileName = `${payload.userId}-${randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");

  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, buffer);

  const publicPath = `/uploads/avatars/${fileName}`;

  // получить текущую аватарку
  const current = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { avatarUrl: true },
  });

  // удалить старую
  await removeFileIfExists(current?.avatarUrl ?? undefined);

  // сохранить новую
  await prisma.user.update({
    where: { id: payload.userId },
    data: { avatarUrl: publicPath },
  });

  return NextResponse.json({ avatarUrl: publicPath });
}

export async function DELETE() {
  const payload = await getAuthPayloadFromCookies();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { avatarUrl: true },
  });

  await removeFileIfExists(current?.avatarUrl ?? undefined);

  await prisma.user.update({
    where: { id: payload.userId },
    data: { avatarUrl: null },
  });

  return NextResponse.json({ ok: true });
}