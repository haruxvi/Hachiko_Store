import { NextResponse, type NextRequest } from 'next/server';
import { commitWebpayTransaction } from '@/src/lib/payments/webpay';
import { confirmPaymentAndMarkPaid, markPaymentFailed } from '@/src/lib/services/payment.service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token_ws');
  const orderId = searchParams.get('TBK_ORDEN_COMPRA');
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';

  if (!token) {
    // User cancelled
    if (orderId) await markPaymentFailed(orderId, 'WEBPAY');
    return NextResponse.redirect(new URL('/checkout/failure', appUrl));
  }

  try {
    const result = await commitWebpayTransaction(token);

    if (!result.authorized || !orderId) {
      if (orderId) await markPaymentFailed(orderId, 'WEBPAY');
      return NextResponse.redirect(new URL('/checkout/failure', appUrl));
    }

    await confirmPaymentAndMarkPaid(orderId, 'WEBPAY', token);
    return NextResponse.redirect(new URL(`/checkout/success?order=${orderId}`, appUrl));
  } catch {
    return NextResponse.redirect(new URL('/checkout/failure', appUrl));
  }
}
