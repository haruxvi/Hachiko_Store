'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/src/components/ui/Icon';
import ShipOrderForm from '@/src/components/panel/ShipOrderForm';
import OrderStepButton from '@/src/components/panel/OrderStepButton';
import { formatCLP } from '@/src/lib/format';

export interface SellerOrder {
  id: string;
  orderNumber: number;
  status: string;
  totalCLP: number;
  shippingMethodLabel: string;
  isPickup: boolean;
  recipientName: string;
  shippingStreet?: string;
  shippingNumber?: string;
  shippingApartment?: string;
  shippingCommune?: string;
  shippingRegion?: string;
  shippingPhone: string;
  shippingNotes?: string;
  items: { name: string; quantity: number }[];
  createdAtLabel: string;
  /** Retiro en tienda ya avisado: días esperando y plazo (null si no aplica) */
  pickup: { daysWaiting: number; deadlineLabel: string; overdue: boolean } | null;
}

// Estado con punto de color — sin badges bordeados, voz de tienda.
function OrderStatus({ status, isPickup }: { status: string; isPickup: boolean }) {
  const map: Record<string, { dot: string; label: string }> = {
    PAID: { dot: 'bg-rust', label: 'Para empacar' },
    PREPARING: { dot: 'bg-tan-mid', label: 'Preparando' },
    SHIPPED: { dot: 'bg-sky-deep', label: isPickup ? 'Listo para retiro' : 'Enviado' },
    DELIVERED: { dot: 'bg-mint-deep', label: isPickup ? 'Retirado' : 'Entregado' },
  };
  const s = map[status] ?? { dot: 'bg-taupe', label: status };
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-soot">
      <span className={`h-[7px] w-[7px] rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// Label sentence case taupe 12px, valor Quicksand 500 (o mono para numéricos).
function FieldShow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-[3px] text-xs font-medium text-taupe">{label}</div>
      <div
        className={`text-sm font-medium leading-[1.45] text-soot ${mono ? 'price-mono' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

export default function OrdersBoard({ orders }: { orders: SellerOrder[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null);
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  // El detalle se abre en un panel lateral que, en pantallas < xl, cae debajo de
  // la tabla. Al elegir una orden lo traemos a la vista para que "Ver" se note.
  // block: 'nearest' evita saltos cuando el panel ya está visible (desktop).
  const detailRef = useRef<HTMLElement | null>(null);
  const skipInitialScroll = useRef(true);
  useEffect(() => {
    if (skipInitialScroll.current) {
      skipInitialScroll.current = false;
      return;
    }
    if (selectedId) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

  const address = selected
    ? [
        [selected.shippingStreet, selected.shippingNumber].filter(Boolean).join(' '),
        selected.shippingApartment,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* ──────── TABLA ──────── */}
      <div className="overflow-hidden rounded-2xl border border-sand bg-snow">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-body">
            <thead>
              <tr className="bg-cream">
                <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Número</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Cliente</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-taupe">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-taupe">Llegó</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const isSelected = o.id === selectedId;
                const itemCount = o.items.reduce((acc, i) => acc + i.quantity, 0);
                return (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={`cursor-pointer border-t border-sand transition ${
                      isSelected ? 'bg-rust/10' : 'bg-snow hover:bg-cream/60'
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-4 align-middle">
                      <span
                        className={`price-mono text-[15px] ${isSelected ? 'text-rust-ink' : 'text-soot'}`}
                      >
                        # {o.orderNumber}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="text-[15px] font-medium leading-snug text-soot">
                        {o.recipientName}
                      </div>
                      <div className="mt-0.5 text-[13px] font-normal text-taupe">
                        {o.isPickup
                          ? 'Retiro en tienda'
                          : [o.shippingCommune, o.shippingRegion].filter(Boolean).join(', ')}
                      </div>
                    </td>
                    <td className="price-mono px-4 py-4 text-right align-middle text-[15px] text-soot">
                      {itemCount}
                    </td>
                    <td className="price-mono whitespace-nowrap px-4 py-4 text-right align-middle text-[15px] text-soot">
                      {formatCLP(o.totalCLP)}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <OrderStatus status={o.status} isPickup={o.isPickup} />
                      {o.pickup && <PickupWait pickup={o.pickup} />}
                    </td>
                    <td className="px-4 py-4 align-middle text-[13px] font-normal text-taupe">
                      {o.createdAtLabel}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-taupe">
                        Ver <Icon name="chevronR" size={12} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────── PANEL DE DESPACHO ──────── */}
      {selected && (
        <aside ref={detailRef} className="flex flex-col rounded-2xl border border-sand bg-snow px-7 py-8">
          <div className="mb-1.5 flex items-start justify-between">
            <div>
              <div className="price-mono text-sm text-rust-ink"># {selected.orderNumber}</div>
              <h2 className="mt-1.5 font-display text-2xl font-medium leading-tight tracking-[-0.015em] text-soot">
                {selected.isPickup ? 'Preparar para ' : 'Despachar a '}
                {selected.recipientName.split(' ')[0]}
              </h2>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              aria-label="Cerrar panel"
              className="rounded-chip p-1.5 text-taupe hover:bg-cream"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <OrderStatus status={selected.status} isPickup={selected.isPickup} />

          {/* Retiro en tienda: cuánto lleva esperando y hasta cuándo */}
          {selected.pickup && (
            <div
              className={`mt-4 rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-[1.45] ${
                selected.pickup.overdue ? 'border-alert/30 bg-alert/[0.08] text-alert' : 'border-sand bg-cream text-soot'
              }`}
            >
              {selected.pickup.overdue ? (
                <>
                  <span className="font-medium">Venció el plazo de retiro ({selected.pickup.deadlineLabel}).</span>
                  <div className="mt-0.5 text-taupe">
                    Si nadie lo viene a buscar, márcalo como no retirado: el stock vuelve y el pago pasa a reembolso.
                  </div>
                </>
              ) : (
                <>
                  <span className="font-medium">
                    Esperando retiro hace {selected.pickup.daysWaiting} {selected.pickup.daysWaiting === 1 ? 'día' : 'días'} · plazo hasta el{' '}
                    {selected.pickup.deadlineLabel}
                  </span>
                  <div className="mt-0.5 text-taupe">Le enviamos recordatorios por correo a los 3 y a los 10 días.</div>
                </>
              )}
            </div>
          )}

          {/* Compliance — punto rust + texto humano, sin escudos */}
          <div className="mt-6 flex items-start gap-2.5 rounded-[10px] border border-sand bg-cream px-3.5 py-2.5">
            <span className="mt-2 h-[7px] w-[7px] shrink-0 rounded-full bg-rust" />
            <div className="text-[13px] font-medium leading-[1.45] text-soot">
              Datos mínimos · Ley 21.719
              <div className="mt-0.5 font-normal text-taupe">
                Solo se muestra lo necesario para el despacho.
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            <FieldShow label="Nombre" value={selected.recipientName} />
            {!selected.isPickup && (
              <>
                {address && <FieldShow label="Dirección" value={address} />}
                <FieldShow
                  label="Comuna y región"
                  value={[selected.shippingCommune, selected.shippingRegion]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </>
            )}
            <FieldShow label="Teléfono" value={selected.shippingPhone} mono />
            {selected.shippingNotes && (
              <FieldShow label="Notas del cliente" value={selected.shippingNotes} />
            )}
          </div>

          {/* En este paquete */}
          <div className="mt-6 rounded-btn border border-sand bg-cream px-4 py-3.5">
            <div className="mb-2.5 text-xs font-medium text-taupe">En este paquete</div>
            <div className="flex flex-col gap-2.5">
              {selected.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1 text-sm font-medium leading-snug text-soot">
                    {item.name}
                  </div>
                  <span className="price-mono text-[13px] text-taupe">×{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tracking + CTA */}
          {(selected.status === 'PAID' || selected.status === 'PREPARING') && (
            <div className="mt-auto flex flex-col gap-3 pt-6">
              {selected.status === 'PAID' && (
                <OrderStepButton key={`prep-${selected.id}`} orderId={selected.id} step="preparing" />
              )}
              <ShipOrderForm
                key={selected.id}
                orderId={selected.id}
                carrierLabel={selected.shippingMethodLabel}
                isPickup={selected.isPickup}
              />
            </div>
          )}
          {selected.status === 'SHIPPED' && (
            <div className="mt-auto flex flex-col gap-3 pt-6">
              <OrderStepButton
                key={`deliv-${selected.id}`}
                orderId={selected.id}
                step="delivered"
                variant="primary"
                label={selected.isPickup ? 'Marcar como retirado' : 'Marcar como entregado'}
              />
              {selected.pickup?.overdue && (
                <OrderStepButton key={`nopick-${selected.id}`} orderId={selected.id} step="notPickedUp" />
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

// Retiro en tienda: días esperando (o plazo vencido) bajo el estado del pedido.
function PickupWait({ pickup }: { pickup: NonNullable<SellerOrder['pickup']> }) {
  return (
    <div className={`mt-1 text-xs ${pickup.overdue ? 'font-medium text-alert' : 'text-taupe'}`}>
      {pickup.overdue
        ? `Plazo vencido (${pickup.deadlineLabel})`
        : `Esperando · ${pickup.daysWaiting} ${pickup.daysWaiting === 1 ? 'día' : 'días'}`}
    </div>
  );
}
