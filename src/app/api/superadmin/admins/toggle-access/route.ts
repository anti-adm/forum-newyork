// src/app/api/superadmin/admins/toggle-access/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthPayloadFromCookies } from '@/lib/auth';
import { logAdminAction } from '@/lib/log';

export async function POST(req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth || auth.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, isActive } = await req.json();
  const targetId = Number(userId);

  if (!Number.isInteger(targetId)) {
    return NextResponse.json(
      { error: 'Некорректный userId' },
      { status: 400 },
    );
  }

  if (targetId === auth.userId) {
    return NextResponse.json(
      { error: 'Нельзя менять свой собственный статус' },
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
      { error: 'Нельзя менять статус системного пользователя' },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { isActive: Boolean(isActive) },
  });

  await logAdminAction(
    auth.userId,
    'TOGGLE_ADMIN',
    `targetId=${targetId}; isActive=${updated.isActive}`,
  );

  return NextResponse.json({
    id: updated.id,
    isActive: updated.isActive,
  });
}