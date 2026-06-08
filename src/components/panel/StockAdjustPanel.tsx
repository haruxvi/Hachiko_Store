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
      <button onClick={() => setOpen(true)} className="text-xs text-rose-600 hover:underline">
        Ajustar
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-bold text-lg mb-1">Ajustar stock</h2>
            <p className="text-sm text-gray-500 mb-4">{productName}</p>
            <p className="text-sm mb-4">
              Stock actual: <span className="font-semibold">{currentStock}</span> unidades
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nuevo stock total
                </label>
                <input
                  name="newStock"
                  type="number"
                  min={0}
                  defaultValue={currentStock}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <select
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as Reason)}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas {needsNotes && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  required={needsNotes}
                  placeholder={needsNotes ? 'Obligatorio para correcciones' : 'Opcional'}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-rose-600 text-white text-sm py-2 rounded-lg hover:bg-rose-700 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar ajuste'}
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setError(''); }}
                  className="flex-1 border text-sm py-2 rounded-lg hover:bg-gray-50"
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
