import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/src/lib/auth/session';
import { writeAudit } from '@/src/lib/services/audit.service';
import { getSession } from '@/src/lib/auth/session';

export async function POST() {
  const session = await getSession();

  if (session) {
    await writeAudit({ actorId: session.sub, actorRole: session.role, action: 'LOGOUT' });
  }

  const response = NextResponse.json({ ok: true });
  for (const { name, options } of clearAuthCookies()) {
    response.cookies.set(name, '', options);
  }

  return response;
}
