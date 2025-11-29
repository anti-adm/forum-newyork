import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "daily_norm" },
    });

    const valueNum = setting ? Number(setting.value) || 0 : 0;

    return NextResponse.json({ value: valueNum });
  } catch (e) {
    console.error("GET /api/settings/norm error", e);
    // чтобы не класть страницу, просто возвращаем 0
    return NextResponse.json({ value: 0 });
  }
}