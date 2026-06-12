'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCartStore } from '@/src/lib/stores/cart';
import { checkoutAction } from '@/src/actions/cart';
import { ShippingAddressSchema, ShippingMethodSchema } from '@/src/lib/validation/schemas';
import { SHIPPING_METHODS, calculateShipping } from '@/src/lib/shipping';
import type { ShippingMethod } from '@prisma/client';
import Icon from '@/src/components/ui/Icon';
import { formatCLP } from '@/src/lib/format';

// La validación condicional (dirección obligatoria solo con despacho) la
// resuelve el servidor vía CheckoutSchema; aquí se replica para feedback
// inmediato en el formulario.
const FormSchema = ShippingAddressSchema.extend({
  shippingMethod: ShippingMethodSchema,
  paymentProvider: z.enum(['WEBPAY', 'MERCADOPAGO'], {
    errorMap: () => ({ message: 'Elige un método de pago' }),
  }),
}).superRefine((data, ctx) => {
  if (data.shippingMethod === 'PICKUP') return;
  for (const field of ['street', 'number', 'commune', 'region'] as const) {
    if (!data[field]?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: 'Requerido para despacho a domicilio',
      });
    }
  }
});

type FormValues = z.infer<typeof FormSchema>;

export interface SavedAddress {
  fullName: string;
  street: string;
  number: string;
  apartment?: string;
  commune: string;
  region: string;
  phone: string;
}

// Sección numerada del checkout — círculo rust + título Zen Maru.
function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-hs mb-4 overflow-hidden">
      <div className="flex items-center gap-4 border-b border-sand px-6 py-5">
        <span className="price-mono flex h-7 w-7 items-center justify-center rounded-full bg-rust text-[13px] font-semibold text-snow">
          {num}
        </span>
        <h2 className="flex-1 font-display text-lg font-bold text-soot">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// Logos estilizados brand-neutral (no son marcas oficiales).
function PayLogo({ name }: { name: 'WEBPAY' | 'MERCADOPAGO' }) {
  if (name === 'WEBPAY') {
    return (
      <span className="flex h-8 w-16 items-center justify-center rounded-md border border-sand bg-snow font-mono text-[11px] font-bold tracking-[0.04em] text-[#0066B3]">
        WEBPAY
      </span>
    );
  }
  return (
    <span className="flex h-8 w-16 items-center justify-center rounded-md bg-[#00B1EA] font-display text-[11px] font-bold text-white">
      mercado
    </span>
  );
}

export default function CheckoutForm({ savedAddress }: { savedAddress: SavedAddress | null }) {
  const { items, clear, total } = useCartStore();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      shippingMethod: 'STARKEN',
      ...(savedAddress ?? {}),
    },
  });

  const method = watch('shippingMethod') as ShippingMethod;
  const provider = watch('paymentProvider');
  const needsAddress = SHIPPING_METHODS[method]?.requiresAddress ?? true;
  const subtotal = total();
  const shippingCost = calculateShipping(subtotal, method);
  const grandTotal = subtotal + shippingCost;

  const onSubmit = async (data: FormValues) => {
    const result = await checkoutAction({
      shippingMethod: data.shippingMethod,
      shippingAddress: {
        fullName: data.fullName,
        street: data.street,
        number: data.number,
        apartment: data.apartment,
        commune: data.commune,
        region: data.region,
        phone: data.phone,
        notes: data.notes,
      },
      paymentProvider: data.paymentProvider,
      items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
    });

    if (!result.ok) {
      alert(result.error);
      return;
    }

    const orderId = result.orderId;

    if (data.paymentProvider === 'WEBPAY') {
      const res = await fetch('/api/payments/webpay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { url: string; token: string } };
      if (json.ok && json.data) {
        clear();
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = json.data.url;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'token_ws';
        input.value = json.data.token;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      }
    } else {
      const res = await fetch('/api/payments/mp/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { initPoint: string } };
      if (json.ok && json.data) {
        clear();
        window.location.href = json.data.initPoint;
      }
    }
  };

  const field = (
    id: keyof Omit<FormValues, 'shippingMethod' | 'paymentProvider'>,
    label: string,
    type = 'text',
  ) => (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-taupe"
      >
        {label}
      </label>
      <input {...register(id)} type={type} id={id} className="input-hs" />
      {errors[id] && <p className="mt-1 text-xs text-alert">{errors[id]?.message}</p>}
    </div>
  );

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* ── 1 · Envío ── */}
        <Section num="1" title="¿A dónde lo enviamos?">
          {/* Método de entrega: lo que se elija aquí es lo ÚNICO que el cliente
              verá después en sus pedidos y correos */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {(Object.keys(SHIPPING_METHODS) as ShippingMethod[]).map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-start gap-3 rounded-btn p-4 transition ${
                  method === m
                    ? 'border-2 border-rust bg-rust/10'
                    : 'border border-sand bg-snow hover:border-taupe'
                }`}
              >
                <input {...register('shippingMethod')} type="radio" value={m} className="sr-only" />
                <span
                  className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    method === m ? 'border-rust bg-rust' : 'border-sand'
                  }`}
                >
                  {method === m && <span className="h-1.5 w-1.5 rounded-full bg-snow" />}
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-soot">
                    {SHIPPING_METHODS[m].label}
                  </span>
                  <span className="text-[11px] leading-snug text-taupe">
                    {SHIPPING_METHODS[m].description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {field('fullName', needsAddress ? 'Nombre del destinatario' : 'Nombre de quien retira')}

            {needsAddress && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {field('street', 'Calle')}
                  {field('number', 'Número')}
                </div>
                {field('apartment', 'Departamento / Casa (opcional)')}
                <div className="grid grid-cols-2 gap-4">
                  {field('commune', 'Comuna')}
                  {field('region', 'Región')}
                </div>
              </>
            )}

            {field('phone', 'Teléfono de contacto')}
            {needsAddress && field('notes', 'Notas de despacho (opcional)')}
          </div>
        </Section>

        {/* ── 2 · Pago ── */}
        <Section num="2" title="¿Cómo pagas?">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: 'WEBPAY', label: 'Webpay Plus', sub: 'Débito y crédito Transbank' },
                { value: 'MERCADOPAGO', label: 'MercadoPago', sub: 'Tarjetas, cuotas sin interés' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col items-start gap-2 rounded-btn p-4 text-left transition ${
                  provider === opt.value
                    ? 'border-2 border-rust bg-rust/10'
                    : 'border border-sand bg-snow hover:border-taupe'
                }`}
              >
                <input
                  {...register('paymentProvider')}
                  type="radio"
                  value={opt.value}
                  className="sr-only"
                />
                <span className="flex w-full items-center justify-between">
                  <PayLogo name={opt.value} />
                  <span
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] ${
                      provider === opt.value ? 'border-rust bg-rust' : 'border-sand'
                    }`}
                  >
                    {provider === opt.value && <span className="h-1.5 w-1.5 rounded-full bg-snow" />}
                  </span>
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-soot">{opt.label}</span>
                  <span className="text-[11px] leading-snug text-taupe">{opt.sub}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.paymentProvider && (
            <p className="mt-2 text-xs text-alert">{errors.paymentProvider.message}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary mt-6 !px-7 !py-4 !text-base disabled:opacity-50"
          >
            <Icon name="lock" size={16} />{' '}
            {isSubmitting ? 'Procesando…' : `Pagar ${formatCLP(grandTotal)}`}
          </button>
        </Section>

        <p className="text-center text-xs text-taupe">
          Al pagar aceptas nuestros{' '}
          <a href="/legal/terminos" className="underline hover:text-rust">
            Términos y Condiciones
          </a>{' '}
          y{' '}
          <a href="/legal/privacidad" className="underline hover:text-rust">
            Política de Privacidad
          </a>
          .
        </p>
      </form>

      {/* ── Resumen sticky ── */}
      <aside className="lg:sticky lg:top-6">
        <div className="card-hs overflow-hidden">
          <div className="flex items-center justify-between border-b border-sand px-6 py-5">
            <h3 className="font-display text-base font-bold text-soot">Tu pedido</h3>
            <span className="text-[13px] text-taupe">
              {items.length} {items.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          <div className="flex flex-col gap-3.5 border-b border-sand p-6">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-chip bg-cream">
                  {item.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- preview de URL externa */
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="ph h-full w-full !border-0 text-[8px]">·</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-soot">{item.name}</div>
                  <div className="text-[11px] text-taupe">x {item.quantity}</div>
                </div>
                <span className="price-mono text-[13px] text-soot">
                  {formatCLP(item.priceCLP * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 border-b border-sand p-6 text-sm">
            <div className="flex justify-between">
              <span className="text-taupe">Subtotal</span>
              <span className="price-mono text-soot">{formatCLP(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-taupe">
                {needsAddress ? 'Despacho a domicilio' : 'Retiro en tienda'}
              </span>
              <span className="price-mono text-soot">
                {shippingCost === 0 ? 'Gratis' : formatCLP(shippingCost)}
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between p-6">
            <span className="font-display text-lg font-bold text-soot">Total</span>
            <span className="price-mono text-2xl text-soot">{formatCLP(grandTotal)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-btn border border-dashed border-sand bg-cream px-4 py-3.5 text-[13px] text-taupe">
          <Icon name="lock" size={16} />
          <div>Compra protegida. No guardamos los datos de tu tarjeta en nuestros servidores.</div>
        </div>
      </aside>
    </div>
  );
}
