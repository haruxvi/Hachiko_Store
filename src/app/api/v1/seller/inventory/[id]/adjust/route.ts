import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adjustStock } from '@/src/lib/services/inventory.service';
import { api, ApiError, jsonBody, limit, ok, options, parse, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Mismas reglas que el ajuste de stock del panel web: motivo obligatorio,
// nota escrita para correcciones manuales, nunca bajo lo reservado en carritos,
// y movimiento de inventario auditado con el vendedor que lo hizo.
const Body = z.object({
  newStock: z.number().int().min(0, 'El stock no puede ser negativo.').max(99999),
  reason: z.enum(['RESTOCK', 'CORRECTION_UP', 'CORRECTION_DOWN', 'DAMAGED', 'EXPIRED', 'RETURNED']),
  notes: z.string().trim().max(500).optional(),
});

const KNOWN = [/^Stock no puede ser negativo/, /^Las correcciones manuales requieren motivo/, /reservad/i];

export const POST = api<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession(req, 'SELLER');
  await limit(req, 'seller-write', 30, 60_000, session.sub);
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw new ApiError(404, 'NOT_FOUND', 'No encontramos ese producto.');
  const body = parse(Body, await jsonBody(req));

  try {
    await adjustStock({ productId: id, newStock: body.newStock, reason: body.reason, notes: body.notes || undefined, actorId: session.sub });
  } catch (e) {
    // Solo los mensajes de negocio (en español, pensados para el usuario) salen tal cual.
    const msg = e instanceof Error && KNOWN.some((re) => re.test(e.message)) ? e.message : 'No se pudo ajustar el stock. Inténtalo de nuevo.';
    throw new ApiError(422, 'ADJUST_FAILED', msg);
  }
  revalidatePath('/trastienda/inventario');
  revalidatePath('/trastienda');
  return ok({ adjusted: true });
});
