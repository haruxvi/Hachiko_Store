'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { createOrder } from '@/src/lib/services/order.service';
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

  try {
    const order = await createOrder(session.sub, parsed.data.items, parsed.data.shippingAddress);
    revalidatePath('/pedidos');
    return { ok: true, orderId: order.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear la orden' };
  }
}
