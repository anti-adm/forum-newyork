import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const value = Number(body.value ?? 0);

    if (Number.isNaN(value) || value < 0) {
      return NextResponse.json(
        { error: "Некорректное значение нормы" },
        { status: 400 }
      );
    }

    await prisma.setting.upsert({
      where: { key: "daily_norm" },
      create: {
        key: "daily_norm",
        value: String(value),
      },
      update: {
        value: String(value),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/settings/daily-norm error", e);
    return NextResponse.json(
      { error: "Не удалось сохранить норму" },
      { status: 500 }
    );
  }
}