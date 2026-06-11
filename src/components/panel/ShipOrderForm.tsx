'use client';

import { useState } from 'react';
import { shipOrderAction } from '@/src/actions/order';

interface Props {
  orderId: string;
  /** Etiqueta del método elegido por el cliente (p. ej. "Starken") */
  carrierLabel: string;
  /** true = retiro en tienda: no hay número de seguimiento */
  isPickup: boolean;
}

export default function ShipOrderForm({ orderId, carrierLabel, isPickup }: Props) {
  const [tracking, setTracking] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPickup && !tracking.trim()) return;
    setLoading(true);
    const result = await shipOrderAction({
      orderId,
      trackingNumber: isPickup ? undefined : tracking.trim(),
    });
    setLoading(false);
    if (result.ok) {
      setDone(true);
    } else {
      setError(result.error ?? 'Error');
    }
  };

  if (done) {
    return (
      <p className="text-sm text-green-600 font-medium">
        ✓ {isPickup ? 'Cliente avisado: pedido listo para retiro' : 'Despacho registrado y cliente avisado'}
      </p>
    );
  }

  return (
    <form onSubmit={handle} className="flex gap-2 items-center">
      {!isPickup && (
        <input
          type="text"
          placeholder={`Número de seguimiento ${carrierLabel}`}
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
      )}
      <button
        type="submit"
        disabled={loading}
        className="bg-rose-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-50"
      >
        {loading ? '…' : isPickup ? 'Marcar listo para retiro' : 'Marcar despachado'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
