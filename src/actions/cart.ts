'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getSession } from '@/src/lib/auth/session';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';
import { createOrder } from '@/src/lib/services/order.service';
import { saveDefaultShippingAddress } from '@/src/lib/services/customer.service';
import { recordCheckoutOrder } from '@/src/lib/services/analytics.service';
import { CheckoutSchema } from '@/src/lib/validation/schemas';
import type { z } from 'zod';

type CheckoutInput = z.infer<typeof CheckoutSchema>;

export async function checkoutAction(
  input: CheckoutInput
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  // Límite de creación de órdenes: cada orden RESERVA stock por 15 min. Sin
  // tope, un atacante autenticado podría crear órdenes en masa y dejar sin
  // stock disponible a los clientes reales (DoS de inventario), además de
  // cargar la base con transacciones Serializable. Se limita por usuario y por IP.
  const ip = clientIpFrom(await headers());
  const perUser = await rateLimit(`checkout:u:${session.sub}`, 12, 5 * 60 * 1000);
  const perIp = await rateLimit(`checkout:ip:${ip}`, 20, 5 * 60 * 1000);
  if (!perUser.allowed || !perIp.allowed) {
    return { ok: false, error: 'Estás creando pedidos muy seguido. Espera unos minutos e inténtalo de nuevo.' };
  }

  const parsed = CheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const { shippingMethod, shippingAddress, items } = parsed.data;

  try {
    const order = await createOrder(session.sub, items, shippingMethod, shippingAddress);

    // Recordar la dirección para precargar el próximo checkout. Solo con
    // despacho a domicilio (el superRefine ya garantizó los campos) y sin
    // bloquear la compra si falla.
    if (shippingMethod !== 'PICKUP') {
      await saveDefaultShippingAddress(session.sub, {
        fullName: shippingAddress.fullName,
        street: shippingAddress.street!,
        number: shippingAddress.number!,
        apartment: shippingAddress.apartment,
        commune: shippingAddress.commune!,
        region: shippingAddress.region!,
        phone: shippingAddress.phone,
      }).catch(() => undefined);
    }

    // Embudo de conversión: vincula la sesión medida con el pedido. Nunca
    // bloquea la compra si falla.
    if (parsed.data.analyticsSessionId) {
      await recordCheckoutOrder(parsed.data.analyticsSessionId, session.sub, order.id).catch(() => undefined);
    }

    revalidatePath('/pedidos');
    return { ok: true, orderId: order.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear la orden' };
  }
}
