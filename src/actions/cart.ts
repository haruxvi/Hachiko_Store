'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { createOrder } from '@/src/lib/services/order.service';
import { CheckoutSchema } from '@/src/lib/validation/schemas';
import type { z } from 'zod';
import type { CartItem } from '@/src/lib/services/order.service';

type CheckoutInput = z.infer<typeof CheckoutSchema> & { items: CartItem[] };

export async function checkoutAction(
  input: CheckoutInput
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const parsed = CheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  if (!input.items || input.items.length === 0) {
    return { ok: false, error: 'El carrito está vacío' };
  }

  try {
    const order = await createOrder(session.sub, input.items, parsed.data.shippingAddress);
    revalidatePath('/pedidos');
    return { ok: true, orderId: order.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear la orden' };
  }
}
