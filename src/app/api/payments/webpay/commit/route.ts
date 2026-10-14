import { NextResponse, type NextRequest } from 'next/server';
import { commitWebpayTransaction, getWebpayBuyOrder } from '@/src/lib/payments/webpay';
import { confirmPaymentAndMarkPaid, markPaymentFailed } from '@/src/lib/services/payment.service';

async function handleReturn(searchParams: URLSearchParams) {
  const token = searchParams.get('token_ws');
  const abortToken = searchParams.get('TBK_TOKEN');
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const failure = (motivo?: string) =>
    NextResponse.redirect(new URL(`/checkout/failure${motivo ? `?motivo=${motivo}` : ''}`, appUrl), 303);

  // Abandono o error del formulario de Webpay (llega TBK_TOKEN). El pedido se
  // obtiene preguntándole a Transbank por ese token, nunca de TBK_ORDEN_COMPRA:
  // ese parámetro lo puede escribir cualquiera y permitiría marcar como
  // fallido el pedido de otra persona. Si Transbank no responde, no se marca
  // nada: la reserva de stock vence sola.
  if (!token || abortToken) {
    if (abortToken) {
      const orderId = await getWebpayBuyOrder(abortToken);
      if (orderId) await markPaymentFailed(orderId, 'WEBPAY').catch(() => undefined);
    }
    return failure();
  }

  try {
    const result = await commitWebpayTransaction(token);
    // El orderId sale de la respuesta de Transbank, nunca del query string
    const orderId = result.buyOrder;

    if (!result.authorized || !orderId) {
      if (orderId) await markPaymentFailed(orderId, 'WEBPAY');
      return failure();
    }

    const outcome = await confirmPaymentAndMarkPaid(orderId, 'WEBPAY', token, result.amount);
    // Cobro autorizado pero el pedido no se puede cumplir: se le dice al
    // cliente que el dinero se devolverá (la tienda ve la alerta de reembolso).
    if (outcome === 'refund_pending' || outcome === 'not_found') return failure('reembolso');
    // 303: tras un POST de Transbank el navegador debe seguir con GET
    return NextResponse.redirect(new URL(`/checkout/success?order=${orderId}`, appUrl), 303);
  } catch (e) {
    // Si Transbank ya autorizó y falló lo nuestro (p. ej. la BD), hay que
    // conciliar a mano: queda en el log con el token para buscarlo en Transbank.
    console.error('[webpay/commit] error al confirmar', { token, error: e instanceof Error ? e.message : e });
    return failure();
  }
}

// Transbank vuelve al comercio por GET o por POST (formulario) según el flujo:
// se aceptan ambos con la misma lógica.
export async function GET(request: NextRequest) {
  return handleReturn(new URL(request.url).searchParams);
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const params = new URLSearchParams();
  form?.forEach((value, key) => {
    if (typeof value === 'string') params.set(key, value);
  });
  return handleReturn(params);
}
