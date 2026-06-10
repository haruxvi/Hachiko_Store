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
