'use client';

import { useState } from 'react';
import { refundOrderAction } from '@/src/actions/order';
import { formatCLP } from '@/src/lib/format';

export interface RefundRow {
  id: string;
  orderNumber: number;
  providerLabel: string;
  amountCLP: number;
  reasonLabel: string;
  whenLabel: string;
  canRefundViaProvider: boolean;
}

/**
 * Pagos que entraron pero no corresponde quedarse (pedido cancelado, sin stock
 * o monto distinto). Hasta resolverlos, el resumen muestra una alerta crítica.
 */
export default function RefundQueue({ rows }: { rows: RefundRow[] }) {
  return (
    <section
      id="reembolsos"
      aria-labelledby="refund-queue-title"
      className="mb-6 mt-6 scroll-mt-6 rounded-[14px] border border-alert/40 bg-snow px-5 py-4"
    >
      <h2 id="refund-queue-title" className="font-display text-lg font-bold text-soot">
        Pagos por reembolsar ({rows.length})
      </h2>
      <p className="mb-3 text-[13px] text-taupe">
        El cliente pagó, pero el pedido no se pudo cumplir. Devuelve el dinero y avísale: al marcarlo le
        enviamos un correo.
      </p>
      <ul className="flex flex-col divide-y divide-sand">
        {rows.map((row) => (
          <RefundItem key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

function RefundItem({ row }: { row: RefundRow }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function run(mode: 'provider' | 'manual') {
    const question =
      mode === 'provider'
        ? `¿Devolver ${formatCLP(row.amountCLP)} del pedido #${row.orderNumber} con ${row.providerLabel}?`
        : `¿Confirmas que ya devolviste ${formatCLP(row.amountCLP)} del pedido #${row.orderNumber} por otro medio?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError('');
    const result = await refundOrderAction(row.id, mode);
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.error ?? 'No se pudo registrar el reembolso.');
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-[180px] flex-1">
        <div className="text-sm font-semibold text-soot">
          Pedido #{row.orderNumber} · <span className="price-mono">{formatCLP(row.amountCLP)}</span>
        </div>
        <div className="text-xs text-taupe">
          {row.reasonLabel} · {row.providerLabel} · {row.whenLabel}
        </div>
        {error && <p className="mt-1 text-xs text-alert">{error}</p>}
      </div>
      {done ? (
        <span className="text-sm font-medium text-mint-ink">Reembolsado · cliente avisado</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {row.canRefundViaProvider && (
            <button type="button" disabled={busy} onClick={() => run('provider')} className="btn-primary btn-sm disabled:opacity-50">
              {busy ? 'Procesando…' : `Reembolsar con ${row.providerLabel}`}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => run('manual')} className="btn-outline btn-sm disabled:opacity-50">
            Ya lo reembolsé
          </button>
        </div>
      )}
    </li>
  );
}
