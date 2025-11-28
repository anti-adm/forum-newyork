// src/app/api/settings/norm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthPayloadFromCookies } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const setting = await prisma.setting.findUnique({
    where: { key: 'daily_norm' },
  });

  const value = setting ? Number(setting.value) || 0 : 0;
  return NextResponse.json({ value });
}