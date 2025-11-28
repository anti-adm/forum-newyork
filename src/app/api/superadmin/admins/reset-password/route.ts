// src/app/api/superadmin/admins/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getAuthPayloadFromCookies } from '@/lib/auth';
import { logAdminAction } from '@/lib/log';

function generatePassword(length = 10): string {
  const chars =
    'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

export async function POST(req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth || auth.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await req.json();
  const targetId = Number(userId);

  if (!Number.isInteger(targetId)) {
    return NextResponse.json(
      { error: 'Некорректный userId' },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) {
    return NextResponse.json(
      { error: 'Пользователь не найден' },
      { status: 404 },
    );
  }

  if (user.isSystem) {
    return NextResponse.json(
      { error: 'Нельзя сбросить пароль системного пользователя' },
      { status: 400 },
    );
  }

  const password = generatePassword(10);
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: targetId },
    data: { passwordHash },
  });

  await logAdminAction(
    auth.userId,
    'RESET_PASSWORD',
    `targetId=${targetId}`,
  );

  return NextResponse.json({ password });
}