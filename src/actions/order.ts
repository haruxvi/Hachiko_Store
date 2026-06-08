'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { markOrderShipped, cancelOrder } from '@/src/lib/services/order.service';
import { TrackingSchema } from '@/src/lib/validation/schemas';
import { z } from 'zod';

export async function shipOrderAction(
  input: z.infer<typeof TrackingSchema>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !['SELLER', 'ADMIN'].includes(session.role)) {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = TrackingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  try {
    await markOrderShipped(parsed.data.orderId, parsed.data.trackingNumber, session.sub, session.role);
    revalidatePath('/trastienda/ordenes');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function cancelOrderAction(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  try {
    await cancelOrder(orderId, session.sub);
    revalidatePath('/pedidos');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}
