'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import {
  markOrderShipped,
  markOrderPreparing,
  markOrderDelivered,
  cancelOrder,
} from '@/src/lib/services/order.service';
import { refundOrder } from '@/src/lib/services/payment.service';
import { TrackingSchema } from '@/src/lib/validation/schemas';
import type { z } from 'zod';

export async function shipOrderAction(
  input: z.infer<typeof TrackingSchema>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    return { ok: false, error: 'Sin permisos' };
  }

  const parsed = TrackingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  try {
    await markOrderShipped(
      parsed.data.orderId,
      parsed.data.trackingNumber?.trim() || null,
      session.sub,
      'SELLER'
    );
    revalidatePath('/trastienda/ordenes');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

const OrderIdSchema = TrackingSchema.shape.orderId;

async function sellerOrderStep(
  orderId: string,
  step: (id: string, actorId: string) => Promise<void>,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return { ok: false, error: 'Sin permisos' };
  const id = OrderIdSchema.safeParse(orderId);
  if (!id.success) return { ok: false, error: 'Pedido inválido' };
  try {
    await step(id.data, session.sub);
    revalidatePath('/trastienda/ordenes');
    revalidatePath('/trastienda');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

/** PAID → PREPARING ("lo estoy empacando"). */
export async function markPreparingAction(orderId: string) {
  return sellerOrderStep(orderId, markOrderPreparing);
}

/** SHIPPED → DELIVERED (entregado por el courier o retirado en tienda). */
export async function markDeliveredAction(orderId: string) {
  return sellerOrderStep(orderId, markOrderDelivered);
}

/**
 * Resuelve un pago marcado para reembolso: por la pasarela ('provider') o
 * registrando que ya se devolvió por fuera ('manual').
 */
export async function refundOrderAction(
  orderId: string,
  mode: 'provider' | 'manual',
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return { ok: false, error: 'Sin permisos' };
  const id = OrderIdSchema.safeParse(orderId);
  if (!id.success || (mode !== 'provider' && mode !== 'manual')) return { ok: false, error: 'Solicitud inválida' };

  const result = await refundOrder(id.data, session.sub, mode);
  if (result.ok) {
    revalidatePath('/trastienda/ordenes');
    revalidatePath('/trastienda');
  }
  return result;
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
