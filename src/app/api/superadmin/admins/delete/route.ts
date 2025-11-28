// src/app/api/superadmin/admins/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthPayloadFromCookies } from '@/lib/auth';
import { logAdminAction } from '@/lib/log';

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

  if (targetId === auth.userId) {
    return NextResponse.json(
      { error: 'Нельзя удалить самого себя' },
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
      { error: 'Нельзя удалить системного пользователя' },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id: targetId } });

  await logAdminAction(
    auth.userId,
    'DELETE_ADMIN',
    `targetId=${targetId}`,
  );

  return NextResponse.json({ ok: true });
}