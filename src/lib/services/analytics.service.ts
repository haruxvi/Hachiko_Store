import { db } from '@/src/lib/db';

// Eventos de comportamiento que se escriben desde el SERVIDOR (los del
// navegador llegan por /api/analytics). AnalyticsEvent es append-only: nunca se
// actualiza un evento, se agregan nuevos.

/** Hora mínima sin pagar para dar un checkout por abandonado. */
export const ABANDON_AFTER_MS = 2 * 60 * 60 * 1000;
/** Hasta cuánto hacia atrás se revisan checkouts (cubre días sin cron). */
const SWEEP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Vincula la sesión de medición con el pedido recién creado (otro
 * CHECKOUT_START, con el orderId en metadata). Solo se llama si el navegador
 * mandó un id de sesión, es decir, si hubo consentimiento de medición.
 */
export async function recordCheckoutOrder(sessionId: string, userId: string, orderId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { consentMarketing: true } });
  await db.analyticsEvent.create({
    data: {
      sessionId,
      userId: user?.consentMarketing ? userId : null,
      type: 'CHECKOUT_START',
      path: '/checkout',
      metadata: { orderId },
    },
  });
}

/**
 * Marca como abandonados los checkouts que llevan más de 2 h sin un pedido
 * pagado. Es idempotente: una sesión que ya tiene CHECKOUT_ABANDON no se vuelve
 * a contar. Lo llama el cron diario de reservas.
 */
export async function sweepAbandonedCheckouts(now = new Date()): Promise<number> {
  const until = new Date(now.getTime() - ABANDON_AFTER_MS);
  const since = new Date(now.getTime() - SWEEP_LOOKBACK_MS);
  return db.$executeRaw`
    INSERT INTO "AnalyticsEvent" (id, "sessionId", "userId", type, path, "createdAt")
    SELECT 'abn_' || md5(s."sessionId"), s."sessionId", s."userId", 'CHECKOUT_ABANDON'::"AnalyticsEventType", '/checkout', ${now}
    FROM (
      SELECT "sessionId", MAX("userId") AS "userId", MAX("createdAt") AS last_start
      FROM "AnalyticsEvent"
      WHERE type = 'CHECKOUT_START' AND "createdAt" >= ${since}
      GROUP BY "sessionId"
    ) s
    WHERE s.last_start < ${until}
      AND NOT EXISTS (
        SELECT 1 FROM "AnalyticsEvent" a
        WHERE a."sessionId" = s."sessionId" AND a.type = 'CHECKOUT_ABANDON'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "AnalyticsEvent" c
        JOIN "Order" o ON o.id = c.metadata->>'orderId'
        WHERE c."sessionId" = s."sessionId" AND c.type = 'CHECKOUT_START' AND o."paymentStatus" = 'PAID'
      )
    ON CONFLICT (id) DO NOTHING`;
}
