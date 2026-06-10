import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/src/lib/auth/session';
import { requireRole } from '@/src/lib/auth/rbac';
import { WebpayCreateSchema } from '@/src/lib/validation/schemas';
import { createWebpayTransaction } from '@/src/lib/payments/webpay';
import { writeAudit } from '@/src/lib/services/audit.service';
import { getUnpaidOrderForUser } from '@/src/lib/services/order.service';

export async function POST(request: NextRequest) {
  const session = await getSession();
  const roleError = requireRole(session, ['CLIENT', 'SELLER']);
  if (roleError) return roleError;

  const body = await request.json();
  const parsed = WebpayCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION' } }, { status: 400 });
  }

  const { orderId } = parsed.data;
  const order = await getUnpaidOrderForUser(orderId, session!.sub);

  if (!order) {
    return NextResponse.json({ ok: false, error: { code: 'ORDER_NOT_FOUND' } }, { status: 404 });
  }

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const returnUrl = `${appUrl}/api/payments/webpay/commit`;

  const { url, token } = await createWebpayTransaction(orderId, order.totalCLP, returnUrl);

  await writeAudit({
    actorId: session!.sub,
    actorRole: session!.role,
    action: 'PAYMENT_INITIATED',
    targetType: 'Order',
    targetId: orderId,
    metadata: { provider: 'WEBPAY' },
  });

  return NextResponse.json({ ok: true, data: { url, token } });
}
