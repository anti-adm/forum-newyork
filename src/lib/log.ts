// src/lib/log.ts
import { prisma } from '@/lib/prisma';

export async function logAdminAction(
  adminId: number,
  action: string,
  meta?: string,
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        meta,
      },
    });
  } catch (err) {
    console.error('Failed to log admin action', err);
  }
}