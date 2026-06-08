'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/src/lib/stores/cart';
import { checkoutAction } from '@/src/actions/cart';
import { ShippingAddressSchema } from '@/src/lib/validation/schemas';

const FormSchema = ShippingAddressSchema.extend({
  paymentProvider: z.enum(['WEBPAY', 'MERCADOPAGO']),
});

type FormValues = z.infer<typeof FormSchema>;

export default function CheckoutForm() {
  const router = useRouter();
  const { items, clear } = useCartStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema) });

  const onSubmit = async (data: FormValues) => {
    const result = await checkoutAction({
      shippingAddress: data,
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
      const json = await res.json() as { ok: boolean; data?: { url: string; token: string } };
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
      const json = await res.json() as { ok: boolean; data?: { initPoint: string } };
      if (json.ok && json.data) {
        clear();
        window.location.href = json.data.initPoint;
      }
    }
  };

  const field = (id: keyof FormValues, label: string, type = 'text') => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">{label}</label>
      <input
        {...register(id)}
        type={type}
        id={id}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
      />
      {errors[id] && <p className="text-xs text-red-500 mt-1">{errors[id]?.message}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {field('fullName', 'Nombre completo')}
      <div className="grid grid-cols-2 gap-4">
        {field('street', 'Calle')}
        {field('number', 'Número')}
      </div>
      {field('apartment', 'Departamento / Casa (opcional)')}
      <div className="grid grid-cols-2 gap-4">
        {field('commune', 'Comuna')}
        {field('region', 'Región')}
      </div>
      {field('phone', 'Teléfono de contacto (+56 9 XXXX XXXX)')}
      {field('notes', 'Notas de despacho (opcional)')}

      <div>
        <p className="text-sm font-medium mb-2">Método de pago</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input {...register('paymentProvider')} type="radio" value="WEBPAY" />
            <span className="text-sm">Webpay Plus</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input {...register('paymentProvider')} type="radio" value="MERCADOPAGO" />
            <span className="text-sm">MercadoPago</span>
          </label>
        </div>
        {errors.paymentProvider && (
          <p className="text-xs text-red-500 mt-1">{errors.paymentProvider.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-rose-500 text-white font-semibold py-3 rounded-full hover:bg-rose-600 transition-colors disabled:opacity-50 mt-2"
      >
        {isSubmitting ? 'Procesando…' : 'Pagar ahora'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Al pagar aceptas nuestros{' '}
        <a href="/legal/terminos" className="underline">Términos y Condiciones</a>
        {' '}y{' '}
        <a href="/legal/privacidad" className="underline">Política de Privacidad</a>.
      </p>
    </form>
  );
}
