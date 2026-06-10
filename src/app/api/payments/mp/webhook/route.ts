import { NextResponse, type NextRequest } from 'next/server';
import { verifyMpWebhookSignature, getMpPayment } from '@/src/lib/payments/mercadopago';
import {
  isWebhookProcessed,
  markWebhookProcessed,
  confirmPaymentAndMarkPaid,
  markPaymentFailed,
} from '@/src/lib/services/payment.service';

export async function POST(request: NextRequest) {
  try {
    const xSignature = request.headers.get('x-signature') ?? '';
    const xRequestId = request.headers.get('x-request-id') ?? '';
    // MP firma sobre el data.id que viene en el query string
    const dataId = request.nextUrl.searchParams.get('data.id') ?? '';
    const webhookSecret = process.env['MP_WEBHOOK_SECRET'] ?? '';

    if (!dataId || !verifyMpWebhookSignature(dataId, xRequestId, xSignature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      data?: { id?: string };
    };

    if (body.type !== 'payment' || !body.data?.id) {
      return NextResponse.json({ ok: true }); // not a payment event
    }

    const paymentId = body.data.id;

    // Idempotency
    if (await isWebhookProcessed(xRequestId)) {
      return NextResponse.json({ ok: true });
    }

    const payment = await getMpPayment(paymentId);

    if (!payment.external_reference) {
      return NextResponse.json({ ok: true });
    }

    const orderId = payment.external_reference;

    if (payment.status === 'approved') {
      await confirmPaymentAndMarkPaid(orderId, 'MERCADOPAGO', paymentId, payment.transaction_amount);
    } else if (['rejected', 'cancelled'].includes(payment.status ?? '')) {
      await markPaymentFailed(orderId, 'MERCADOPAGO');
    }

    await markWebhookProcessed(xRequestId, 'MERCADOPAGO');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
