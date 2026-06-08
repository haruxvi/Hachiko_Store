import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createHmac, timingSafeEqual } from 'crypto';

const client = new MercadoPagoConfig({
  accessToken: process.env['MP_ACCESS_TOKEN'] ?? '',
});

interface MpItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: 'CLP';
}

export async function createMpPreference(
  orderId: string,
  items: MpItem[],
  appUrl: string
): Promise<string> {
  const preference = new Preference(client);
  const response = await preference.create({
    body: {
      external_reference: orderId,
      items,
      back_urls: {
        success: `${appUrl}/checkout/success`,
        failure: `${appUrl}/checkout/failure`,
        pending: `${appUrl}/checkout/pending`,
      },
      auto_return: 'approved' as const,
      notification_url: `${appUrl}/api/payments/mp/webhook`,
    },
  });

  if (!response.init_point) throw new Error('MercadoPago no retornó init_point');
  return response.init_point;
}

export async function getMpPayment(paymentId: string) {
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

export function verifyMpWebhookSignature(
  rawBody: string,
  xRequestId: string,
  xSignature: string,
  webhookSecret: string
): boolean {
  const parts = xSignature.split(',');
  const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1];
  const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')[1];
  if (!ts || !v1) return false;

  const manifest = `id:${xRequestId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac('sha256', webhookSecret).update(manifest).digest('hex');

  return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
