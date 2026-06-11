'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { createOrder } from '@/src/lib/services/order.service';
import { saveDefaultShippingAddress } from '@/src/lib/services/customer.service';
import { CheckoutSchema } from '@/src/lib/validation/schemas';
import type { z } from 'zod';

type CheckoutInput = z.infer<typeof CheckoutSchema>;

export async function checkoutAction(
  input: CheckoutInput
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

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

    revalidatePath('/pedidos');
    return { ok: true, orderId: order.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear la orden' };
  }
}
