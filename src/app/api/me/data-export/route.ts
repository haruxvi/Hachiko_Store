import { NextResponse } from 'next/server';
import { getSession } from '@/src/lib/auth/session';
import { requireRole } from '@/src/lib/auth/rbac';
import { rateLimit } from '@/src/lib/rate-limit';
import { exportUserData } from '@/src/lib/services/customer.service';

export async function GET() {
  const session = await getSession();
  const roleError = requireRole(session, ['CLIENT', 'SELLER']);
  if (roleError) return roleError;

  // Cada exportación descifra datos y deja registro (solicitud + auditoría): sin
  // tope, una cuenta podía llenar esas tablas a voluntad.
  const limited = await rateLimit(`data-export:${session!.sub}`, 5, 60 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: 'Ya descargaste tus datos varias veces. Inténtalo en una hora.' } },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  const data = await exportUserData(session!.sub);
  return NextResponse.json({ ok: true, data });
}
