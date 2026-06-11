import { anonymizeExpiredAuditData } from '@/src/lib/services/audit.service';
import { requireCronAuth } from '@/src/lib/auth/cron';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req.headers);
  if (authError) return authError;

  const result = await anonymizeExpiredAuditData();
  return NextResponse.json(result);
}
