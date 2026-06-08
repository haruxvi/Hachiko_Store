import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/src/lib/auth/session';
import { requireRole } from '@/src/lib/auth/rbac';
import { requestAccountDeletion } from '@/src/lib/services/customer.service';
import { DeleteAccountSchema } from '@/src/lib/validation/schemas';
import { clearAuthCookies } from '@/src/lib/auth/session';

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  // Solo los clientes pueden eliminar su propia cuenta desde la UI
  const roleError = requireRole(session, ['CLIENT']);
  if (roleError) return roleError;

  const body = await request.json().catch(() => ({}));
  const parsed = DeleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION' } }, { status: 400 });
  }

  await requestAccountDeletion(session!.sub, parsed.data.reason);

  const response = NextResponse.json({
    ok: true,
    message: 'Cuenta eliminada. Los datos serán purgados en 30 días.',
  });

  for (const { name, options } of clearAuthCookies()) {
    response.cookies.set(name, '', options);
  }

  return response;
}
