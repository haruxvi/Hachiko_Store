'use client';

import { useState } from 'react';
import { shipOrderAction } from '@/src/actions/order';
import Icon from '@/src/components/ui/Icon';

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
      <p className="flex items-center gap-2 text-sm font-medium text-mint-deep">
        <Icon name="check" size={16} stroke={2} />
        {isPickup ? 'Cliente avisado: pedido listo para retiro' : 'Despacho registrado y cliente avisado'}
      </p>
    );
  }

  return (
    <form onSubmit={handle}>
      {!isPickup && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-taupe">Tracking {carrierLabel}</span>
          <input
            type="text"
            placeholder="ST·••••••"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className="input-hs price-mono !text-sm"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary mt-3 w-full justify-center disabled:opacity-50"
      >
        <Icon name="truck" size={16} />
        {loading ? 'Guardando…' : isPickup ? 'Marcar listo para retiro' : 'Marcar como enviado'}
      </button>
      {error && <p className="mt-2 text-xs text-alert">{error}</p>}
    </form>
  );
}
