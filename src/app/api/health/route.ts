import { NextResponse } from 'next/server';
import { db } from '@/src/lib/db';

// Cada request debe tocar la base de verdad: así un ping externo (uptime cron)
// mantiene despierto a Neon y evita el cold start de ~7 s en la primera visita.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: 'connected', ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: 'disconnected' }, { status: 503 });
  }
}
