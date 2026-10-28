import { anonymizeExpiredAuditData } from '@/src/lib/services/audit.service';
import { purgeStalePendingSubscribers } from '@/src/lib/services/newsletter.service';
import { executeDueDeletions } from '@/src/lib/services/customer.service';
import { requireCronAuth } from '@/src/lib/auth/cron';
import { purgeExpiredRefreshTokens } from '@/src/lib/auth/rotate';
import { NextResponse, type NextRequest } from 'next/server';

// Tareas diarias de retención de datos (Ley 21.719, minimización y supresión).
// Van en el mismo cron porque el plan Hobby de Vercel limita la cantidad de crons.
export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req.headers);
  if (authError) return authError;

  const [audit, newsletter, deletions, refreshTokens] = await Promise.all([
    anonymizeExpiredAuditData(),
    purgeStalePendingSubscribers(),
    executeDueDeletions(),
    purgeExpiredRefreshTokens(),
  ]);
  return NextResponse.json({
    ...audit,
    pendingSubscribersPurged: newsletter.purged,
    accountsDeleted: deletions.executed,
    accountDeletionsPostponed: deletions.postponed,
    expiredRefreshTokensPurged: refreshTokens,
  });
}
