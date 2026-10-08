import { getSession } from '@/src/lib/auth/session';
import { getOrdersForSeller } from '@/src/lib/services/order.service';
import { shippingLabel, SHIPPING_METHODS } from '@/src/lib/shipping';
import { formatCLP } from '@/src/lib/format';
import OrdersBoard, { type SellerOrder } from '@/src/components/panel/OrdersBoard';
import ListToolbar from '@/src/components/panel/ListToolbar';
import PanelPagination from '@/src/components/panel/PanelPagination';
import {
  matchesQuery,
  paginate,
  parseOption,
  parsePage,
  parsePageSize,
  parseQuery,
  DEFAULT_PAGE_SIZE,
  type RawSearchParams,
} from '@/src/lib/panel-list';

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
          accent ? 'text-rust-ink' : 'text-soot'
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

const BASE = '/trastienda/ordenes';
const STATUS_FILTERS = ['todas', 'empacar', 'enviadas'] as const;
const DELIVERY_FILTERS = ['todas', 'domicilio', 'retiro'] as const;
const TO_PACK = new Set(['PAID', 'PREPARING']);

export default async function OrdenesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const sp = await searchParams;
  const q = parseQuery(sp['q']);
  const statusFilter = parseOption(sp['estado'], STATUS_FILTERS, 'todas');
  const deliveryFilter = parseOption(sp['entrega'], DELIVERY_FILTERS, 'todas');
  const perPage = parsePageSize(sp['mostrar']);
  const page = parsePage(sp['pagina']);

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

  // KPIs sobre todas las órdenes, no sobre lo filtrado.
  const porEmpacar = orders.filter((o) => TO_PACK.has(o.status));
  const enviadas = orders.filter((o) => o.status === 'SHIPPED');
  const ventasPendientes = porEmpacar.reduce((acc, o) => acc + o.totalCLP, 0);

  // Los nombres y direcciones están cifrados en la base: no se pueden buscar con
  // SQL, así que se filtra aquí, sobre los datos ya descifrados para el despacho.
  const matching = orders.filter(
    (o) =>
      (statusFilter === 'todas' ||
        (statusFilter === 'empacar' ? TO_PACK.has(o.status) : o.status === 'SHIPPED')) &&
      (deliveryFilter === 'todas' || (deliveryFilter === 'retiro') === o.isPickup) &&
      matchesQuery(
        q.replace(/^#\s*/, ''),
        o.orderNumber,
        o.recipientName,
        o.shippingCommune,
        o.shippingRegion,
        ...o.items.map((i) => i.name),
      ),
  );
  const info = paginate(matching.length, page, perPage);
  const pageOrders = matching.slice(info.skip, info.skip + info.take);

  const params = {
    q: q || undefined,
    estado: statusFilter !== 'todas' ? statusFilter : undefined,
    entrega: deliveryFilter !== 'todas' ? deliveryFilter : undefined,
    mostrar: perPage !== DEFAULT_PAGE_SIZE ? String(perPage) : undefined,
  };
  const filtered = Boolean(q || statusFilter !== 'todas' || deliveryFilter !== 'todas');

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
        <>
          <ListToolbar
            basePath={BASE}
            query={q}
            perPage={perPage}
            searchLabel="Buscar orden"
            placeholder="Número, cliente, comuna o producto"
            clearable={filtered}
            filters={[
              {
                name: 'estado',
                label: 'Estado',
                value: statusFilter,
                options: [
                  { value: 'todas', label: 'Todas' },
                  { value: 'empacar', label: 'Por empacar' },
                  { value: 'enviadas', label: 'Enviadas' },
                ],
              },
              {
                name: 'entrega',
                label: 'Entrega',
                value: deliveryFilter,
                options: [
                  { value: 'todas', label: 'Todas' },
                  { value: 'domicilio', label: 'Despacho a domicilio' },
                  { value: 'retiro', label: 'Retiro en tienda' },
                ],
              },
            ]}
          />
          {pageOrders.length === 0 ? (
            <p className="rounded-2xl border border-sand bg-snow px-4 py-10 text-center text-[15px] text-taupe-deep">
              Ninguna orden coincide con la búsqueda o los filtros.
            </p>
          ) : (
            // La key reinicia la orden seleccionada al cambiar de página o de filtro.
            <OrdersBoard key={JSON.stringify({ ...params, pagina: info.page })} orders={pageOrders} />
          )}
          <PanelPagination basePath={BASE} params={params} info={info} noun={['orden', 'órdenes']} />
        </>
      )}
    </div>
  );
}
