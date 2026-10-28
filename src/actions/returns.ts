'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { rateLimit } from '@/src/lib/rate-limit';
import { ReturnDecisionSchema, ReturnRequestSchema } from '@/src/lib/validation/schemas';
import {
  approveReturn,
  createReturnRequest,
  receiveReturn,
  rejectReturn,
  resolveReturn,
  ReturnError,
} from '@/src/lib/services/returns.service';

type Result = { ok: true; requestNumber?: number } | { ok: false; error: string };

const GENERIC = 'No pudimos guardar el cambio. Inténtalo de nuevo en unos minutos.';
const message = (e: unknown) => (e instanceof ReturnError ? e.message : GENERIC);

// ─── Cliente ──────────────────────────────────────────────

export async function createReturnRequestAction(input: unknown): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Inicia sesión para solicitar un cambio o devolución.' };

  const limited = await rateLimit(`return-request:${session.sub}`, 5, 60 * 60 * 1000);
  if (!limited.allowed) return { ok: false, error: 'Enviaste varias solicitudes seguidas. Espera un rato e inténtalo otra vez.' };

  const parsed = ReturnRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisa los datos de la solicitud.' };

  try {
    // El dueño del pedido sale de la sesión: el servicio busca el pedido por (id, userId).
    const request = await createReturnRequest(session.sub, parsed.data);
    revalidatePath('/pedidos');
    revalidatePath('/trastienda/devoluciones');
    return { ok: true, requestNumber: request.requestNumber };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

// ─── Vendedor ─────────────────────────────────────────────

async function sellerStep(input: unknown, step: (id: string, actorId: string, note: string) => Promise<void>): Promise<Result> {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return { ok: false, error: 'Sin permisos' };
  const parsed = ReturnDecisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Solicitud inválida' };
  try {
    await step(parsed.data.returnId, session.sub, parsed.data.note ?? '');
    revalidatePath('/trastienda/devoluciones');
    revalidatePath('/trastienda');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function approveReturnAction(input: unknown) {
  return sellerStep(input, approveReturn);
}

export async function rejectReturnAction(input: unknown) {
  return sellerStep(input, rejectReturn);
}

export async function receiveReturnAction(input: unknown, restock: boolean) {
  return sellerStep(input, (id, actor) => receiveReturn(id, actor, restock === true));
}

export async function resolveReturnAction(input: unknown, refundMode: 'provider' | 'manual' = 'provider') {
  return sellerStep(input, (id, actor, note) =>
    resolveReturn(id, actor, { refundMode: refundMode === 'manual' ? 'manual' : 'provider', note }),
  );
}
