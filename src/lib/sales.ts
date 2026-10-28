import { Prisma } from '@prisma/client';

// Qué cuenta como VENTA en todo el panel (y en los modelos de /ml, que usan la
// misma regla): pagada y no cancelada. Una orden cancelada después de pagar se
// reembolsa; sumarla inflaba ingresos, márgenes, top de productos y modelos.
//
// Los ingresos se miden como venta de productos (subtotal), sin el envío: el
// envío lo paga el cliente para cubrir el courier, no es venta de la tienda.

export const SALE_WHERE = {
  paymentStatus: 'PAID',
  status: { not: 'CANCELLED' },
} satisfies Prisma.OrderWhereInput;

/** El mismo filtro para SQL crudo; la orden debe tener el alias `o`. */
export const SALE_SQL = Prisma.sql`o."paymentStatus" = 'PAID' AND o.status <> 'CANCELLED'`;

/** Fecha de una orden en hora de Chile (timestamp sin zona), para agrupar por día/mes. */
export const localTs = (col: Prisma.Sql) => Prisma.sql`((${col}) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago'`;
