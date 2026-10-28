'use client';

import { useState } from 'react';
import {
  approveReturnAction,
  receiveReturnAction,
  rejectReturnAction,
  resolveReturnAction,
} from '@/src/actions/returns';
import { formatCLP } from '@/src/lib/format';

type Status = 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'RESOLVED' | 'REJECTED';
type Resolution = 'EXCHANGE' | 'REFUND' | 'REPAIR';

/** Acciones del vendedor sobre una solicitud, según su estado. */
export default function ReturnActions({
  id,
  status,
  resolution,
  restocked,
  amountCLP,
  canRefundViaProvider,
  providerLabel,
}: {
  id: string;
  status: Status;
  resolution: Resolution;
  restocked: boolean;
  amountCLP: number;
  canRefundViaProvider: boolean;
  providerLabel: string;
}) {
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  if (status === 'RESOLVED' || status === 'REJECTED') return null;
  if (done) return <p className="text-sm font-medium text-mint-ink">{done}</p>;

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError('');
    const result = await fn();
    setBusy(false);
    if (result.ok) setDone(success);
    else setError(result.error ?? 'No se pudo guardar.');
  }

  const canReject = status === 'REQUESTED' || status === 'APPROVED' || (status === 'RECEIVED' && !restocked);
  const noteField = (label: string, placeholder: string) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-taupe">{label}</span>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={placeholder}
        className="input-hs w-full !text-sm"
      />
    </label>
  );

  return (
    <div className="space-y-3">
      {rejecting ? (
        <>
          {noteField('Motivo del rechazo (le llega al cliente)', 'Ej.: el skincare está abierto y no presenta falla, así que no aplica el retracto.')}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => rejectReturnAction({ returnId: id, note }), 'Solicitud rechazada · cliente avisado')}
              className="btn-primary btn-sm disabled:opacity-50"
            >
              Rechazar solicitud
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="btn-link text-sm">
              Volver
            </button>
          </div>
        </>
      ) : (
        <>
          {status === 'REQUESTED' && (
            <>
              {noteField('Instrucciones para el cliente', 'Ej.: tráelo a la tienda de Recoleta de lunes a viernes, 10:00 a 18:00, con el número de pedido.')}
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => approveReturnAction({ returnId: id, note }), 'Solicitud aprobada · cliente avisado')}
                className="btn-primary btn-sm disabled:opacity-50"
              >
                Aprobar solicitud
              </button>
            </>
          )}

          {status === 'APPROVED' && (
            <>
              <label className="flex items-start gap-2 text-sm text-soot">
                <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rust" />
                <span>
                  Está en condiciones de venderse otra vez
                  <span className="block text-xs text-taupe">Vuelve al stock. Desmárcalo si viene con falla.</span>
                </span>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => receiveReturnAction({ returnId: id }, restock), 'Producto recibido · cliente avisado')}
                className="btn-primary btn-sm disabled:opacity-50"
              >
                Marcar como recibido
              </button>
            </>
          )}

          {status === 'RECEIVED' && (
            <>
              {noteField('Nota para el cliente (opcional)', { EXCHANGE: 'Ej.: el cambio ya está listo para retiro.', REFUND: 'Ej.: el abono puede tardar unos días hábiles en verse en tu tarjeta.', REPAIR: 'Ej.: detalle de la reparación.' }[resolution])}
              <div className="flex flex-wrap gap-2">
                {resolution === 'EXCHANGE' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => resolveReturnAction({ returnId: id, note }),
                        'Cambio entregado · stock actualizado',
                        '¿Entregas el producto de reemplazo? Se descuenta del stock.',
                      )
                    }
                    className="btn-primary btn-sm disabled:opacity-50"
                  >
                    Entregar cambio
                  </button>
                )}
                {resolution === 'REPAIR' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => resolveReturnAction({ returnId: id, note }), 'Reparación registrada · cliente avisado')}
                    className="btn-primary btn-sm disabled:opacity-50"
                  >
                    Marcar como reparado
                  </button>
                )}
                {resolution === 'REFUND' && (
                  <>
                    {canRefundViaProvider && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => resolveReturnAction({ returnId: id, note }, 'provider'),
                            'Dinero devuelto · cliente avisado',
                            `¿Devolver ${formatCLP(amountCLP)} con ${providerLabel}?`,
                          )
                        }
                        className="btn-primary btn-sm disabled:opacity-50"
                      >
                        {busy ? 'Procesando…' : `Devolver ${formatCLP(amountCLP)} con ${providerLabel}`}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => resolveReturnAction({ returnId: id, note }, 'manual'),
                          'Devolución registrada · cliente avisado',
                          `¿Confirmas que ya devolviste ${formatCLP(amountCLP)} por otro medio?`,
                        )
                      }
                      className="btn-outline btn-sm disabled:opacity-50"
                    >
                      Ya lo devolví por fuera
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {canReject && (
            <button type="button" onClick={() => setRejecting(true)} className="btn-link text-sm text-alert">
              No corresponde: rechazar con motivo
            </button>
          )}
        </>
      )}

      {error && <p className="text-xs text-alert">{error}</p>}
    </div>
  );
}
