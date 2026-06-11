'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startGuestCheckoutAction } from '@/src/actions/guest';

// Puerta del checkout para no autenticados: iniciar sesión, crear cuenta o
// continuar como invitado (solo email + consentimiento esencial).
export default function GuestCheckoutGate() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const result = await startGuestCheckoutAction({
      email: fd.get('email') as string,
      consentEssential: fd.get('consentEssential') === 'on' ? true : (false as never),
    });

    if (result.ok) {
      // Ya hay sesión de invitado: el checkout se muestra al refrescar
      router.refresh();
      return;
    }

    setError(result.error ?? 'No se pudo continuar');
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border rounded-xl p-5">
        <h2 className="font-semibold mb-1">¿Ya tienes cuenta?</h2>
        <p className="text-sm text-gray-500 mb-3">
          Inicia sesión para usar tus datos guardados y ver tus pedidos.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login?next=/checkout"
            className="bg-rose-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-rose-700"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="border text-sm font-medium px-5 py-2 rounded-lg hover:bg-gray-50"
          >
            Crear cuenta
          </Link>
        </div>
      </div>

      <div className="border rounded-xl p-5">
        <h2 className="font-semibold mb-1">Continuar como invitado</h2>
        <p className="text-sm text-gray-500 mb-4">
          Solo necesitamos tu correo para enviarte la confirmación y el seguimiento de tu
          compra. Después podrás crear una contraseña con ese mismo correo si quieres ver
          tus pedidos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="guest-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="guest-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" name="consentEssential" required className="mt-0.5" />
            <span>
              Acepto el tratamiento de mis datos para procesar esta compra según la{' '}
              <Link href="/legal/privacidad" className="underline" target="_blank">
                Política de Privacidad
              </Link>{' '}
              (Ley 21.719).
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full border-2 border-rose-500 text-rose-600 text-sm font-semibold py-2.5 rounded-lg hover:bg-rose-50 disabled:opacity-50"
          >
            {loading ? 'Un momento…' : 'Continuar como invitado'}
          </button>
        </form>
      </div>
    </div>
  );
}
