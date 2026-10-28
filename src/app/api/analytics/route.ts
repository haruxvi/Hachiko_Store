import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/src/lib/db';
import { getSession } from '@/src/lib/auth/session';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';
import { DbIdSchema } from '@/src/lib/validation/schemas';

// Recepción de eventos del embudo (ver src/lib/analytics/client.ts). Solo llega
// algo si la persona aceptó la medición en el aviso de cookies.
const EventSchema = z.object({
  type: z.enum(['PAGE_VIEW', 'PRODUCT_VIEW', 'SEARCH', 'ADD_TO_CART', 'REMOVE_FROM_CART', 'CHECKOUT_START']),
  sessionId: z.string().uuid(),
  productId: DbIdSchema.optional(),
  query: z.string().trim().max(100).optional(),
  results: z.number().int().min(0).max(100_000).optional(),
  path: z.string().max(200).startsWith('/').optional(),
});

const BOT_UA = /bot|crawl|spider|slurp|preview|monitor|lighthouse|headless/i;
const NO_CONTENT = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  // Solo desde el propio sitio: otra página no puede inyectar eventos falsos.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.nextUrl.host) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  if (BOT_UA.test(request.headers.get('user-agent') ?? '')) return NO_CONTENT();

  const limited = await rateLimit(`analytics:${clientIpFrom(request.headers)}`, 120, 60_000);
  if (!limited.allowed) return NO_CONTENT(); // se descarta en silencio: medir nunca bloquea al cliente

  const text = await request.text();
  if (text.length > 2048) return NextResponse.json({ ok: false }, { status: 413 });
  let parsed;
  try {
    parsed = EventSchema.safeParse(JSON.parse(text));
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const e = parsed.data;

  // La cuenta se asocia solo con consentimiento comercial y sin señal Global
  // Privacy Control del navegador; en cualquier otro caso el evento es anónimo.
  let userId: string | null = null;
  const session = await getSession();
  if (session && request.headers.get('sec-gpc') !== '1') {
    const user = await db.user.findUnique({ where: { id: session.sub }, select: { consentMarketing: true, role: true } });
    if (user?.role === 'SELLER') return NO_CONTENT(); // el equipo de la tienda no cuenta como cliente
    if (user?.consentMarketing) userId = session.sub;
  }

  await db.analyticsEvent.create({
    data: {
      sessionId: e.sessionId,
      userId,
      type: e.type,
      productId: e.productId ?? null,
      query: e.type === 'SEARCH' ? (e.query?.toLowerCase() ?? null) : null,
      path: e.path ?? null,
      metadata: (e.type === 'SEARCH' && e.results !== undefined ? { results: e.results } : undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
  return NO_CONTENT();
}
