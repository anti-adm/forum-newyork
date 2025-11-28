// src/app/api/settings/daily-norm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthPayloadFromCookies } from '@/lib/auth';
import { logAdminAction } from '@/lib/log';

export async function POST(req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { value } = await req.json();
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric < 0) {
    return NextResponse.json(
      { error: 'Норма должна быть целым числом >= 0' },
      { status: 400 },
    );
  }

  const setting = await prisma.setting.upsert({
    where: { key: 'daily_norm' },
    update: { value: String(numeric) },
    create: { key: 'daily_norm', value: String(numeric) },
  });

  await logAdminAction(auth.userId, 'CHANGE_NORM', `newValue=${numeric}`);

  return NextResponse.json({ value: Number(setting.value) });
}