import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import {
  getSellerDashboardKpis,
  getTopSellingProducts,
  getLowStockProducts,
  getDailyRevenue,
  getInventoryValuation,
} from '@/src/lib/services/dashboard.service';
import { PageHeader, Eyebrow, Stat, num } from '@/src/components/panel/intelligence-ui';
import { formatCLP } from '@/src/lib/format';

export const revalidate = 30;

// Todas las ventas de esta página: pagadas, no canceladas, venta de productos
// sin envío y por días de Chile (ver src/lib/sales.ts y src/lib/store-time.ts).
export default async function DashboardPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const [kpis, topProducts, lowStock, dailyRevenue, valuation] = await Promise.all([
    getSellerDashboardKpis(),
    getTopSellingProducts(),
    getLowStockProducts(),
    getDailyRevenue(),
    getInventoryValuation(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Resumen" subtitle="Cómo va la tienda hoy" />

      <section className="space-y-3">
        <Eyebrow>Operación</Eyebrow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href="/trastienda/ordenes?estado=empacar" className="block rounded-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/40">
            <Stat
              label="Por empacar"
              value={num(kpis.operational.toPack)}
              hint="Pagadas y aún sin enviar"
              accent={kpis.operational.toPack > 0}
            />
          </Link>
          <Stat label="En preparación" value={num(kpis.operational.preparing)} hint="Ya se están armando" />
          <Stat label="Esperando pago" value={num(kpis.operational.awaitingPayment)} hint="Pedidos de las últimas 24 h" />
        </div>
      </section>

      <section className="space-y-3">
        <Eyebrow>Ventas de productos (sin envío ni canceladas)</Eyebrow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="Hoy"
            value={formatCLP(kpis.revenue.today)}
            hint={`${kpis.revenue.todayCount} ${kpis.revenue.todayCount === 1 ? 'orden' : 'órdenes'}`}
          />
          <Stat label="Últimos 7 días" value={formatCLP(kpis.revenue.week)} />
          <Stat label="Últimos 30 días" value={formatCLP(kpis.revenue.month)} />
        </div>
      </section>

      <section className="space-y-3">
        <Eyebrow>Inventario</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
          <Stat
            label="Bajo el umbral"
            value={num(kpis.inventory.lowStockCount)}
            accent={kpis.inventory.lowStockCount > 0}
          />
          <Stat label="Productos activos" value={num(kpis.inventory.totalProductsActive)} />
          <Stat label="Unidades en stock" value={num(kpis.inventory.totalStockUnits)} />
          <Stat
            label="Valor al costo"
            value={formatCLP(valuation.atCost)}
            hint={
              valuation.withoutCost > 0
                ? `${valuation.withoutCost} ${valuation.withoutCost === 1 ? 'producto sin costo, no incluido' : 'productos sin costo, no incluidos'}`
                : undefined
            }
          />
          <Stat label="Valor a precio de venta" value={formatCLP(valuation.atRetail)} />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <Eyebrow>Más vendidos · 30 días</Eyebrow>
          <div className="card-hs overflow-hidden">
            {topProducts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-taupe-deep">Sin ventas en el período.</p>
            ) : (
              <ul>
                {topProducts.map((p) => (
                  <li key={p.productId} className="flex items-center justify-between gap-4 border-t border-sand px-5 py-3 first:border-t-0">
                    <span className="text-[15px] text-soot">{p.productName}</span>
                    <span className="price-mono text-[14px] text-taupe-deep">{num(p.unitsSold)} uds.</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <Eyebrow>Bajo stock</Eyebrow>
          <div className="card-hs overflow-hidden">
            {lowStock.length === 0 ? (
              <p className="px-5 py-6 text-sm text-taupe-deep">Todos los productos tienen stock suficiente.</p>
            ) : (
              <ul>
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 border-t border-sand px-5 py-3 first:border-t-0">
                    <span className="text-[15px] text-soot">{p.name}</span>
                    <span className={`price-mono text-[14px] font-semibold ${p.stock === 0 ? 'text-alert' : 'text-rust-ink'}`}>
                      {p.stock === 0 ? 'Sin stock' : `${p.stock} uds.`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {dailyRevenue.length > 0 && (
        <section className="space-y-3">
          <Eyebrow>Ventas diarias · últimos 10 días con ventas</Eyebrow>
          <div className="card-hs overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-cream">
                  <th className="px-5 py-3 text-left text-xs font-medium text-taupe">Fecha</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-taupe">Órdenes</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-taupe">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {dailyRevenue
                  .slice(-10)
                  .reverse()
                  .map((d) => (
                    <tr key={d.date.toISOString()} className="border-t border-sand">
                      <td className="px-5 py-3 text-soot">
                        {new Date(d.date).toLocaleDateString('es-CL', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="price-mono px-5 py-3 text-right text-taupe-deep">{d.orders}</td>
                      <td className="price-mono px-5 py-3 text-right text-soot">{formatCLP(d.revenue)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
