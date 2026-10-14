import { WebpayPlus, Environment, Options } from 'transbank-sdk';

const commerceCode = process.env['TBK_COMMERCE_CODE'] ?? '';
const apiKey = process.env['TBK_API_KEY'] ?? '';
const tbkEnv = process.env['TBK_ENV'] === 'production' ? Environment.Production : Environment.Integration;

function getTx() {
  return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, tbkEnv));
}

export async function createWebpayTransaction(
  orderId: string,
  amount: number,
  returnUrl: string
): Promise<{ url: string; token: string }> {
  const response = await getTx().create(orderId, `session_${orderId}`, amount, returnUrl);
  return { url: response.url, token: response.token };
}

/**
 * Orden de compra asociada a un token de Transbank, consultada a Transbank.
 * Se usa en el flujo de abandono (TBK_TOKEN): así el pedido a marcar como
 * fallido sale de Transbank y no de un parámetro de la URL que cualquiera
 * puede escribir. Devuelve null si Transbank no reconoce el token.
 */
export async function getWebpayBuyOrder(token: string): Promise<string | null> {
  try {
    const response = await getTx().status(token);
    return (response.buy_order as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Devuelve el dinero de una transacción autorizada. Transbank decide si es una
 * reversa (mismo día, monto total) o una anulación; si ya pasó el plazo
 * permitido para el medio de pago, lanza y el reembolso se hace por fuera.
 */
export async function refundWebpayTransaction(token: string, amount: number): Promise<{ type: string }> {
  const response = await getTx().refund(token, amount);
  return { type: String(response?.type ?? 'REFUNDED') };
}

export async function commitWebpayTransaction(
  token: string
): Promise<{
  authorized: boolean;
  buyOrder?: string;
  authorizationCode?: string;
  amount?: number;
}> {
  const response = await getTx().commit(token);
  const authorized = response.response_code === 0;
  return {
    authorized,
    buyOrder: response.buy_order as string | undefined,
    authorizationCode: authorized ? (response.authorization_code as string | undefined) : undefined,
    amount: response.amount as number | undefined,
  };
}
