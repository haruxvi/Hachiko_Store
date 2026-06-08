import { NextResponse } from 'next/server';
import { getSession } from '@/src/lib/auth/session';
import { requireRole } from '@/src/lib/auth/rbac';
import { exportUserData } from '@/src/lib/services/customer.service';

export async function GET() {
  const session = await getSession();
  const roleError = requireRole(session, ['CLIENT', 'SELLER']);
  if (roleError) return roleError;

  const data = await exportUserData(session!.sub);
  return NextResponse.json({ ok: true, data });
}
