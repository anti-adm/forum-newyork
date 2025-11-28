// src/app/api/punishments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthPayloadFromCookies } from '@/lib/auth';
import { logAdminAction } from '@/lib/log';

function buildCommand(
  type: string,
  staticId: number,
  duration: number,
  complaintCode: string,
): string {
  const c = complaintCode ? `Жалоба ${complaintCode}` : '';
  switch (type) {
    case 'ajail':
      return `/ajail ${staticId} ${duration} ${c}`.trim();
    case 'mute':
      return `/mute ${staticId} ${duration} ${c}`.trim();
    case 'warn':
      return `/warn ${staticId} ${c}`.trim();
    case 'ban':
      return `/ban ${staticId} ${duration} ${c}`.trim();
    case 'hardban':
      return `/hardban ${staticId} ${duration} ${c}`.trim();
    default:
      return `/warn ${staticId} ${c}`.trim();
  }
}

export async function GET(req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const adminIdParam = searchParams.get('adminId');

  let adminId = auth.userId;
  if (auth.role === 'SUPERADMIN' && adminIdParam) {
    const parsed = Number(adminIdParam);
    if (!Number.isNaN(parsed)) {
      adminId = parsed;
    }
  }

  const [user, punishments] = await Promise.all([
    prisma.user.findUnique({ where: { id: adminId } }),
    prisma.punishment.findMany({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    punishments,
    lastComplaintCode: user?.lastComplaintCode ?? null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { type, staticId, duration, complaintCode, issued } = body;

  if (!type || !staticId || !complaintCode) {
    return NextResponse.json(
      { error: 'Заполните тип, staticId и код жалобы' },
      { status: 400 },
    );
  }

  const validTypes = ['ajail', 'mute', 'warn', 'ban', 'hardban'];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: 'Недопустимый тип наказания' },
      { status: 400 },
    );
  }

  const parsedStaticId = Number(staticId);
  if (!Number.isInteger(parsedStaticId) || parsedStaticId <= 0) {
    return NextResponse.json(
      { error: 'staticId должен быть положительным числом' },
      { status: 400 },
    );
  }

  let finalDuration = 0;
  let durationUnit = 'NONE';
  if (type !== 'warn') {
    const d = Number(duration);
    if (!Number.isInteger(d) || d <= 0) {
      return NextResponse.json(
        { error: 'Продолжительность должна быть положительным числом' },
        { status: 400 },
      );
    }
    finalDuration = d;
    durationUnit = 'MINUTES';
  }

  const command = buildCommand(
    type,
    parsedStaticId,
    finalDuration,
    complaintCode,
  );

  const punishment = await prisma.punishment.create({
    data: {
      adminId: auth.userId,
      type,
      staticId: parsedStaticId,
      duration: finalDuration,
      durationUnit,
      complaintCode,
      issued: Boolean(issued),
      command,
    },
  });

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      lastComplaintCode: complaintCode,
      lastComplaintUpdatedAt: new Date(),
    },
  });

  await logAdminAction(
    auth.userId,
    'CREATE_PUNISHMENT',
    `punishmentId=${punishment.id}; type=${type}; staticId=${parsedStaticId}`,
  );

  return NextResponse.json({ punishment, command });
}