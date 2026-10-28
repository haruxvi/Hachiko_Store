'use client';

import { useState } from 'react';
import { markDeliveredAction, markNotPickedUpAction, markPreparingAction } from '@/src/actions/order';
import Icon from '@/src/components/ui/Icon';

const STEPS = {
  preparing: { action: markPreparingAction, label: 'Marcar como preparando', icon: 'box', done: 'Pedido en preparación', confirm: null },
  delivered: { action: markDeliveredAction, label: 'Marcar como entregado', icon: 'check', done: 'Pedido entregado', confirm: null },
  notPickedUp: {
    action: markNotPickedUpAction,
    label: 'Marcar como no retirado',
    icon: 'close',
    done: 'Pedido cancelado · pasó a reembolsos',
    confirm: '¿Nadie lo vino a buscar? El pedido se cancela, el stock vuelve y el pago pasa a la lista de reembolsos. Le avisamos al cliente por correo.',
  },
} as const;

/** Avanza un pedido en el flujo de despacho (preparando / entregado / no retirado). */
export default function OrderStepButton({
  orderId,
  step,
  label,
  variant = 'secondary',
}: {
  orderId: string;
  step: keyof typeof STEPS;
  label?: string;
  variant?: 'primary' | 'secondary';
}) {
  const config = STEPS[step];
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (done) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-mint-ink">
        <Icon name="check" size={16} stroke={2} />
        {config.done}
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          if (config.confirm && !window.confirm(config.confirm)) return;
          setLoading(true);
          setError('');
          const result = await config.action(orderId);
          setLoading(false);
          if (result.ok) setDone(true);
          else setError(result.error ?? 'Error');
        }}
        className={`${variant === 'primary' ? 'btn-primary' : 'btn-outline'} w-full justify-center disabled:opacity-50`}
      >
        <Icon name={config.icon} size={16} />
        {loading ? 'Guardando…' : (label ?? config.label)}
      </button>
      {error && <p className="mt-2 text-xs text-alert">{error}</p>}
    </div>
  );
}
