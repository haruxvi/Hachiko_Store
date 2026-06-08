import { getSession } from '@/src/lib/auth/session';
import {
  getSellerDashboardKpis,
  getTopSellingProducts,
  getLowStockProducts,
  getDailyRevenue,
  getInventoryValuation,
} from '@/src/lib/services/dashboard.service';

export const revalidate = 30;

function formatCLP(amount: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

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
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Operational KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Operacional</h2>
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Órdenes por despachar hoy" value={kpis.operational.ordersToShipToday} />
          <KpiCard label="En preparación" value={kpis.operational.readyToShip} />
          <KpiCard label="Esperando pago (24h)" value={kpis.operational.awaitingPayment} />
        </div>
      </section>

      {/* Revenue */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Ventas</h2>
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label={`Hoy (${kpis.revenue.todayCount} órdenes)`}
            value={formatCLP(kpis.revenue.today)}
          />
          <KpiCard label="Últimos 7 días" value={formatCLP(kpis.revenue.week)} />
          <KpiCard label="Últimos 30 días" value={formatCLP(kpis.revenue.month)} />
        </div>
      </section>

      {/* Inventory */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Inventario</h2>
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label="Productos con bajo stock"
            value={kpis.inventory.lowStockCount}
            alert={kpis.inventory.lowStockCount > 0}
          />
          <KpiCard label="Productos activos" value={kpis.inventory.totalProductsActive} />
          <KpiCard label="Unidades en stock" value={kpis.inventory.totalStockUnits} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <KpiCard label="Valorización al costo" value={formatCLP(valuation.atCost)} />
          <KpiCard label="Valorización al precio" value={formatCLP(valuation.atRetail)} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-8">
        {/* Top selling */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
            Top productos (30 días)
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">Sin ventas en el período.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.productId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{p.productName}</td>
                    <td className="py-2 text-right font-medium">{p.unitsSold} uds.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Low stock alerts */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
            Bajo stock
          </h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400">Todos los productos tienen stock suficiente.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{p.name}</td>
                    <td className="py-2 text-right">
                      <span
                        className={`font-medium ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}
                      >
                        {p.stock === 0 ? 'Sin stock' : `${p.stock} uds.`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Revenue chart (simple table) */}
      {dailyRevenue.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
            Ventas diarias (últimos 30 días)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Fecha</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-500">Órdenes</th>
                  <th className="text-right py-2 font-medium text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dailyRevenue.slice(-10).reverse().map((d) => (
                  <tr key={d.date.toISOString()} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {new Date(d.date).toLocaleDateString('es-CL')}
                    </td>
                    <td className="py-2 pr-4 text-right">{d.orders}</td>
                    <td className="py-2 text-right font-medium">{formatCLP(d.revenue)}</td>
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

function KpiCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-amber-300 bg-amber-50' : 'bg-white'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-amber-700' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}
