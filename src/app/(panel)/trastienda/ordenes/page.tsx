import { getSession } from '@/src/lib/auth/session';
import { getOrdersForSeller } from '@/src/lib/services/order.service';
import { shippingLabel, SHIPPING_METHODS } from '@/src/lib/shipping';
import { formatCLP } from '@/src/lib/format';
import OrdersBoard, { type SellerOrder } from '@/src/components/panel/OrdersBoard';

// KPI — número en mono tabular, label en sentence case.
function Stat({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: string;
  caption: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-sand bg-snow px-[18px] py-4">
      <div className="mb-2.5 text-[13px] font-medium text-taupe">{label}</div>
      <div
        className={`price-mono text-[28px] leading-none tracking-[-0.02em] ${
          accent ? 'text-rust' : 'text-soot'
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-xs font-normal text-taupe">{caption}</div>
    </div>
  );
}

function whenLabel(date: Date): string {
  const now = new Date();
  const time = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return `hoy ${time}`;
  if (diffDays === 1) return `ayer ${time}`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export default async function OrdenesPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const raw = await getOrdersForSeller();

  const orders: SellerOrder[] = raw.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalCLP: o.totalCLP,
    shippingMethodLabel: shippingLabel(o.shippingMethod),
    isPickup: !SHIPPING_METHODS[o.shippingMethod].requiresAddress,
    recipientName: o.recipientName,
    shippingStreet: o.shippingStreet,
    shippingNumber: o.shippingNumber,
    shippingApartment: o.shippingApartment,
    shippingCommune: o.shippingCommune,
    shippingRegion: o.shippingRegion,
    shippingPhone: o.shippingPhone,
    shippingNotes: o.shippingNotes,
    items: o.items,
    createdAtLabel: whenLabel(new Date(o.createdAt)),
  }));

  const porEmpacar = orders.filter((o) => o.status === 'PAID');
  const enviadas = orders.filter((o) => o.status === 'SHIPPED');
  const ventasPendientes = porEmpacar.reduce((acc, o) => acc + o.totalCLP, 0);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div>
      <header className="mb-2">
        <div className="mb-1.5 text-[13px] font-medium capitalize text-taupe">{dateLabel}</div>
        <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-soot">
          Órdenes para despachar
        </h1>
        <div className="editorial mt-1.5 text-[15px] leading-snug text-taupe">
          Trastienda — solo lo necesario para despachar, según Ley 21.719.
        </div>
      </header>

      {/* KPIs — solo datos reales, nada inventado */}
      <div className="mb-6 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Por empacar"
          value={String(porEmpacar.length)}
          caption={
            porEmpacar.length > 0
              ? 'pedidos antes de las 14:00 salen hoy'
              : 'nada pendiente — al día'
          }
          accent={porEmpacar.length > 0}
        />
        <Stat
          label="Enviadas"
          value={String(enviadas.length)}
          caption="con tracking informado al cliente"
        />
        <Stat
          label="Por despachar en plata"
          value={formatCLP(ventasPendientes)}
          caption="suma de las órdenes pagadas sin enviar"
        />
      </div>

      {orders.length === 0 ? (
        <p className="py-12 text-taupe">No hay órdenes pagadas pendientes de despacho.</p>
      ) : (
        <OrdersBoard orders={orders} />
      )}
    </div>
  );
}
