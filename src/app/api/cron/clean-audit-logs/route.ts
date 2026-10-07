import { anonymizeExpiredAuditData } from '@/src/lib/services/audit.service';
import { purgeStalePendingSubscribers } from '@/src/lib/services/newsletter.service';
import { requireCronAuth } from '@/src/lib/auth/cron';
import { NextResponse, type NextRequest } from 'next/server';

// Tareas diarias de retención de datos (Ley 21.719, minimización). Van en el mismo
// cron porque el plan Hobby de Vercel limita la cantidad de crons.
export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req.headers);
  if (authError) return authError;

  const [audit, newsletter] = await Promise.all([anonymizeExpiredAuditData(), purgeStalePendingSubscribers()]);
  return NextResponse.json({ ...audit, pendingSubscribersPurged: newsletter.purged });
}
