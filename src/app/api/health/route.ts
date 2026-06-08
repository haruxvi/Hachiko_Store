import { NextResponse } from 'next/server';
import { db } from '@/src/lib/db';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: 'connected', ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: 'disconnected' }, { status: 503 });
  }
}
