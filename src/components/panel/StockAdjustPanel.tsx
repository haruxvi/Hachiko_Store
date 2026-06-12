'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adjustStockAction } from '@/src/actions/inventory';

const REASONS = [
  { value: 'RESTOCK', label: 'Reabastecimiento' },
  { value: 'CORRECTION_UP', label: 'Corrección al alza' },
  { value: 'CORRECTION_DOWN', label: 'Corrección a la baja' },
  { value: 'DAMAGED', label: 'Mermado / dañado' },
  { value: 'EXPIRED', label: 'Vencido' },
  { value: 'RETURNED', label: 'Devolución de cliente' },
  { value: 'INITIAL_LOAD', label: 'Carga inicial' },
] as const;

type Reason = (typeof REASONS)[number]['value'];

export default function StockAdjustPanel({
  productId,
  productName,
  currentStock,
}: {
  productId: string;
  productName: string;
  currentStock: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState<Reason>('RESTOCK');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const result = await adjustStockAction({
      productId,
      newStock: Number(fd.get('newStock')),
      reason: fd.get('reason') as Reason,
      notes: (fd.get('notes') as string) || undefined,
    });

    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  const needsNotes = ['CORRECTION_UP', 'CORRECTION_DOWN'].includes(reason);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[13px] font-medium text-rust transition hover:text-rust-dark hover:underline"
      >
        Ajustar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soot/40 p-4">
          <div className="w-full max-w-md rounded-card border border-sand bg-snow p-6 shadow-lift">
            <h2 className="font-display text-xl font-bold tracking-[-0.015em] text-soot">
              Ajustar stock
            </h2>
            <p className="editorial mt-0.5 text-[15px] text-taupe">{productName}</p>
            <p className="mb-4 mt-3 text-sm text-soot">
              Stock actual: <span className="price-mono font-semibold">{currentStock}</span>{' '}
              unidades
            </p>

            {error && (
              <div className="mb-4 rounded-btn border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-taupe">
                  Nuevo stock total
                </label>
                <input
                  name="newStock"
                  type="number"
                  min={0}
                  defaultValue={currentStock}
                  required
                  className="input-hs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-taupe">
                  Motivo
                </label>
                <select
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as Reason)}
                  required
                  className="input-hs"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-taupe">
                  Notas {needsNotes && <span className="text-alert">*</span>}
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  required={needsNotes}
                  placeholder={needsNotes ? 'Obligatorio para correcciones' : 'Opcional'}
                  className="input-hs"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={loading} className="btn-primary btn-sm flex-1 disabled:opacity-50">
                  {loading ? 'Guardando...' : 'Guardar ajuste'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError('');
                  }}
                  className="btn-outline btn-sm flex-1"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
