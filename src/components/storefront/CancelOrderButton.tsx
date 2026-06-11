'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelOrderAction } from '@/src/actions/order';

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (!confirm('¿Cancelar este pedido? El stock reservado quedará disponible nuevamente.')) return;
    setLoading(true);
    const result = await cancelOrderAction(orderId);
    setLoading(false);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error ?? 'No se pudo cancelar');
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handle}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-red-500 underline disabled:opacity-50"
      >
        {loading ? 'Cancelando…' : 'Cancelar pedido'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  );
}
