import { getSession } from '@/src/lib/auth/session';
import { countReturnsByFilter, listReturns, GARANTIA_MONTHS, RETRACTO_DAYS, type ReturnFilter } from '@/src/lib/services/returns.service';
import ListToolbar from '@/src/components/panel/ListToolbar';
import PanelPagination from '@/src/components/panel/PanelPagination';
import ReturnActions from '@/src/components/panel/ReturnActions';
import { formatCLP } from '@/src/lib/format';
import {
  DEFAULT_PAGE_SIZE,
  paginate,
  parseOption,
  parsePage,
  parsePageSize,
  parseQuery,
  type RawSearchParams,
} from '@/src/lib/panel-list';

const BASE = '/trastienda/devoluciones';
const FILTERS = ['pendientes', 'en-curso', 'cerradas', 'todas'] as const satisfies readonly ReturnFilter[];

const STATUS = {
  REQUESTED: { dot: 'bg-rust', label: 'Por revisar' },
  APPROVED: { dot: 'bg-tan-mid', label: 'Aprobada · esperando el producto' },
  RECEIVED: { dot: 'bg-sky-deep', label: 'Producto recibido · por resolver' },
  RESOLVED: { dot: 'bg-mint-deep', label: 'Resuelta' },
  REJECTED: { dot: 'bg-taupe', label: 'Rechazada' },
} as const;
const TYPE_LABEL = { RETRACTO: `Retracto (${RETRACTO_DAYS} días)`, GARANTIA: `Garantía legal (${GARANTIA_MONTHS} meses)` } as const;
const RESOLUTION_LABEL = { EXCHANGE: 'Cambio', REFUND: 'Devolución del dinero', REPAIR: 'Reparación' } as const;
const PROVIDER_LABEL: Record<string, string> = { WEBPAY: 'Webpay', MERCADOPAGO: 'MercadoPago' };

export default async function DevolucionesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const sp = await searchParams;
  const q = parseQuery(sp['q']);
  const estado = parseOption(sp['estado'], FILTERS, 'pendientes');
  const perPage = parsePageSize(sp['mostrar']);
  const page = parsePage(sp['pagina']);

  const [rows, counts] = await Promise.all([listReturns(estado, q), countReturnsByFilter()]);
  const info = paginate(rows.length, page, perPage);
  const pageRows = rows.slice(info.skip, info.skip + info.take);
  const params = {
    q: q || undefined,
    estado: estado !== 'pendientes' ? estado : undefined,
    mostrar: perPage !== DEFAULT_PAGE_SIZE ? String(perPage) : undefined,
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-soot">Cambios y devoluciones</h1>
        <p className="editorial mt-1.5 text-[15px] leading-snug text-taupe">
          Solicitudes de clientes según la Ley del Consumidor: retracto de {RETRACTO_DAYS} días y garantía legal de {GARANTIA_MONTHS} meses.
        </p>
      </header>

      <ListToolbar
        basePath={BASE}
        query={q}
        perPage={perPage}
        searchLabel="Buscar"
        placeholder="N° de solicitud o pedido, correo o producto"
        clearable={Boolean(q || estado !== 'pendientes')}
        filters={[
          {
            name: 'estado',
            label: 'Mostrar solo',
            value: estado,
            options: [
              { value: 'pendientes', label: `Por revisar (${counts.pendientes})` },
              { value: 'en-curso', label: `En curso (${counts['en-curso']})` },
              { value: 'cerradas', label: `Cerradas (${counts.cerradas})` },
              { value: 'todas', label: `Todas (${counts.todas})` },
            ],
          },
        ]}
      />

      {pageRows.length === 0 ? (
        <div className="rounded-2xl border border-sand bg-snow px-6 py-10 text-center">
          <p className="font-display text-lg font-bold text-soot">
            {q ? 'Ninguna solicitud coincide con la búsqueda' : estado === 'pendientes' ? 'No hay solicitudes por revisar' : 'No hay solicitudes aquí'}
          </p>
          <p className="mt-1 text-sm text-taupe">Cuando un cliente pida un cambio o devolución desde &ldquo;Mis pedidos&rdquo;, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pageRows.map((r) => (
            <article key={r.id} className="rounded-2xl border border-sand bg-snow p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-soot">
                    Solicitud #{r.requestNumber} <span className="font-body text-sm font-normal text-taupe">· pedido #{r.orderNumber}</span>
                  </h2>
                  <p className="mt-0.5 text-[13px] text-taupe">
                    {r.customerEmail} · {r.createdAt.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-soot">
                  <span className={`h-[7px] w-[7px] rounded-full ${STATUS[r.status].dot}`} />
                  {STATUS[r.status].label}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip-hs">{TYPE_LABEL[r.type]}</span>
                <span className="chip-hs">El cliente eligió: {RESOLUTION_LABEL[r.resolution]}</span>
                <span className="chip-hs price-mono">{formatCLP(r.amountCLP)}</span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-taupe">Productos</p>
                  <ul className="text-sm text-soot">
                    {r.items.map((it, i) => (
                      <li key={i}>
                        {it.quantity}× {it.name}
                      </li>
                    ))}
                  </ul>
                  <p className="mb-1 mt-3 text-xs font-medium text-taupe">Lo que contó el cliente</p>
                  <p className="whitespace-pre-line text-sm text-soot">{r.reason}</p>
                  {r.sellerNote && (
                    <>
                      <p className="mb-1 mt-3 text-xs font-medium text-taupe">{r.status === 'REJECTED' ? 'Motivo del rechazo' : 'Nota para el cliente'}</p>
                      <p className="whitespace-pre-line text-sm text-soot">{r.sellerNote}</p>
                    </>
                  )}
                  {r.status === 'RESOLVED' && r.refundCLP != null && (
                    <p className="mt-3 text-sm text-mint-ink">Devuelto: {formatCLP(r.refundCLP)}</p>
                  )}
                </div>
                <ReturnActions
                  id={r.id}
                  status={r.status}
                  resolution={r.resolution}
                  restocked={r.restocked}
                  amountCLP={r.amountCLP}
                  canRefundViaProvider={r.canRefundViaProvider}
                  providerLabel={PROVIDER_LABEL[r.paymentProvider ?? ''] ?? 'la pasarela'}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      <PanelPagination basePath={BASE} params={params} info={info} noun={['solicitud', 'solicitudes']} />
    </div>
  );
}
