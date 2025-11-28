// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthPayloadFromCookies } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const auth = await getAuthPayloadFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(auth);
}