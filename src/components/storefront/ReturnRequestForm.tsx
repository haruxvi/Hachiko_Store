'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createReturnRequestAction } from '@/src/actions/returns';
import { formatCLP } from '@/src/lib/format';

type Type = 'RETRACTO' | 'GARANTIA';
type Resolution = 'EXCHANGE' | 'REFUND' | 'REPAIR';

const RESOLUTIONS: Record<Type, Resolution[]> = {
  RETRACTO: ['EXCHANGE', 'REFUND'],
  GARANTIA: ['EXCHANGE', 'REPAIR', 'REFUND'],
};

const RESOLUTION_COPY: Record<Resolution, { title: string; hint: string }> = {
  EXCHANGE: { title: 'Cambio', hint: 'Te entregamos el mismo producto, nuevo.' },
  REFUND: { title: 'Devolución del dinero', hint: 'Te devolvemos lo que pagaste por estos productos, por el mismo medio de pago.' },
  REPAIR: { title: 'Reparación', hint: 'Reparamos el producto sin costo.' },
};

interface Item {
  orderItemId: string;
  productName: string;
  quantity: number;
  unitPriceCLP: number;
  returnable: number;
}

export default function ReturnRequestForm({
  orderId,
  items,
  windows,
  retractoDays,
  garantiaMonths,
}: {
  orderId: string;
  items: Item[];
  windows: Record<Type, { open: boolean; until: string }>;
  retractoDays: number;
  garantiaMonths: number;
}) {
  // Cantidad elegida por ítem (0 = no incluido)
  const [qty, setQty] = useState<Record<string, number>>({});
  const [type, setType] = useState<Type | null>(windows.RETRACTO.open ? null : 'GARANTIA');
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<number | null>(null);

  const chosen = items.filter((i) => (qty[i.orderItemId] ?? 0) > 0);
  const total = chosen.reduce((a, i) => a + i.unitPriceCLP * (qty[i.orderItemId] ?? 0), 0);

  function chooseType(t: Type) {
    setType(t);
    if (resolution && !RESOLUTIONS[t].includes(resolution)) setResolution(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (chosen.length === 0) return setError('Elige al menos un producto.');
    if (!type) return setError('Cuéntanos si te arrepentiste o si el producto tiene una falla.');
    if (!resolution) return setError('Elige qué prefieres: cambio, devolución del dinero o reparación.');
    if (reason.trim().length < 10) return setError('Cuéntanos qué pasó (mínimo 10 caracteres).');

    setSending(true);
    const result = await createReturnRequestAction({
      orderId,
      type,
      resolution,
      reason: reason.trim(),
      items: chosen.map((i) => ({ orderItemId: i.orderItemId, quantity: qty[i.orderItemId] })),
    });
    setSending(false);
    if (result.ok) setSent(result.requestNumber ?? 0);
    else setError(result.error);
  }

  if (sent !== null) {
    return (
      <div className="rounded-card border border-sand bg-cream px-5 py-6 text-center">
        <p className="font-display text-lg font-bold text-soot">Solicitud #{sent} enviada</p>
        <p className="mt-2 text-sm leading-relaxed text-taupe">
          Te enviamos un correo de confirmación. La revisamos y te escribimos con los pasos para entregarnos el producto.
        </p>
        <Link href="/pedidos" className="btn-primary mt-4 inline-flex justify-center">
          Volver a mis pedidos
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      {/* 1. Productos */}
      <fieldset>
        <legend className="mb-3 font-display text-lg font-bold text-soot">1. ¿Qué productos?</legend>
        <div className="divide-y divide-sand rounded-card border border-sand bg-snow">
          {items.map((i) => {
            const value = qty[i.orderItemId] ?? 0;
            const disabled = i.returnable === 0;
            return (
              <div key={i.orderItemId} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${disabled ? 'opacity-60' : ''}`}>
                <label className="flex flex-1 items-center gap-3 text-sm text-soot">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={value > 0}
                    onChange={(e) => setQty((q) => ({ ...q, [i.orderItemId]: e.target.checked ? 1 : 0 }))}
                    className="h-4 w-4 accent-rust"
                  />
                  <span>
                    {i.productName}
                    <span className="block text-xs text-taupe">
                      {disabled ? 'Ya incluido en otra solicitud' : `${formatCLP(i.unitPriceCLP)} c/u · compraste ${i.quantity}`}
                    </span>
                  </span>
                </label>
                {value > 0 && i.returnable > 1 && (
                  <label className="flex items-center gap-2 text-xs text-taupe">
                    Cantidad
                    <select
                      value={value}
                      onChange={(e) => setQty((q) => ({ ...q, [i.orderItemId]: Number(e.target.value) }))}
                      className="rounded-input border border-sand bg-snow px-2 py-1.5 text-sm text-soot"
                    >
                      {Array.from({ length: i.returnable }, (_, n) => n + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* 2. Motivo legal */}
      <fieldset>
        <legend className="mb-3 font-display text-lg font-bold text-soot">2. ¿Qué pasó?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice
            name="type"
            checked={type === 'RETRACTO'}
            disabled={!windows.RETRACTO.open}
            onChange={() => chooseType('RETRACTO')}
            title="Me arrepentí de la compra"
            hint={
              windows.RETRACTO.open
                ? `Hasta el ${windows.RETRACTO.until} (${retractoDays} días desde que lo recibiste). Sin uso y con su embalaje; snacks y skincare abiertos solo si tienen falla.`
                : `El plazo de ${retractoDays} días venció el ${windows.RETRACTO.until}. Si el producto tiene una falla, usa la garantía.`
            }
          />
          <Choice
            name="type"
            checked={type === 'GARANTIA'}
            onChange={() => chooseType('GARANTIA')}
            title="El producto tiene una falla"
            hint={`Garantía legal hasta el ${windows.GARANTIA.until} (${garantiaMonths} meses desde que lo recibiste).`}
          />
        </div>
      </fieldset>

      {/* 3. Resolución: la elige el cliente */}
      {type && (
        <fieldset>
          <legend className="mb-1 font-display text-lg font-bold text-soot">3. ¿Qué prefieres?</legend>
          {type === 'GARANTIA' && <p className="mb-3 text-[13px] text-taupe">Con la garantía legal, tú eliges la opción.</p>}
          <div className={`mt-3 grid gap-3 ${RESOLUTIONS[type].length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {RESOLUTIONS[type].map((r) => (
              <Choice
                key={r}
                name="resolution"
                checked={resolution === r}
                onChange={() => setResolution(r)}
                title={RESOLUTION_COPY[r].title}
                hint={r === 'REFUND' && total > 0 ? `${RESOLUTION_COPY[r].hint} Total: ${formatCLP(total)}.` : RESOLUTION_COPY[r].hint}
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* 4. Detalle */}
      <label className="block">
        <span className="mb-1 block font-display text-lg font-bold text-soot">{type ? 4 : 3}. Cuéntanos qué pasó</span>
        <span className="mb-3 block text-[13px] text-taupe">Si tiene una falla, descríbela: nos ayuda a resolver más rápido.</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={4}
          className="input-hs w-full !text-sm"
          placeholder="Ej.: el lightstick no enciende aunque le cambié las pilas."
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg border border-alert/30 bg-alert/[0.08] px-4 py-3 text-sm text-alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={sending} className="btn-primary disabled:opacity-50">
          {sending ? 'Enviando…' : 'Enviar solicitud'}
        </button>
        <Link href="/pedidos" className="btn-link">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Choice({
  name,
  checked,
  disabled,
  onChange,
  title,
  hint,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-card border px-4 py-3.5 transition ${
        checked ? 'border-rust bg-rust/[0.06]' : 'border-sand bg-snow hover:border-tan'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="mt-1 h-4 w-4 accent-rust" />
      <span>
        <span className="block text-sm font-semibold text-soot">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-taupe">{hint}</span>
      </span>
    </label>
  );
}
