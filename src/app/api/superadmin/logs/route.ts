// src/app/api/superadmin/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthPayloadFromCookies } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth || auth.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const limit = Math.min(Number(limitParam) || 30, 100);

  const logs = await prisma.adminLog.findMany({
    include: {
      admin: { select: { username: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json(
    logs.map((l: any) => ({
      id: l.id,
      adminId: l.adminId,
      adminName: l.admin.username,
      action: l.action,
      meta: l.meta,
      createdAt: l.createdAt.toISOString(),
    })),
  );
}

// TODO: при необходимости добавить /logs/clear