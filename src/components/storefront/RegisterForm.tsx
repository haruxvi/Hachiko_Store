'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fd.get('email'),
        password: fd.get('password'),
        firstName: fd.get('firstName'),
        lastName: fd.get('lastName'),
        consentEssential: fd.get('consentEssential') === 'on',
        consentMarketing: fd.get('consentMarketing') === 'on',
      }),
    });
    const json = await res.json();

    if (json.ok) {
      router.push('/');
      router.refresh();
      return;
    }

    setError(json.error?.message ?? 'Error al crear la cuenta');
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input
            name="firstName"
            required
            maxLength={100}
            autoComplete="given-name"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
          <input
            name="lastName"
            required
            maxLength={100}
            autoComplete="family-name"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          Mínimo 8 caracteres, con mayúscula, minúscula y un número. Evita números
          consecutivos o repetidos (ej. 123 o 111).
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="consentEssential" required className="mt-0.5" />
          <span>
            Acepto el tratamiento de mis datos personales necesario para operar mi cuenta y mis
            compras, según la{' '}
            <Link href="/legal/privacidad" className="text-rose-600 hover:underline" target="_blank">
              Política de Privacidad
            </Link>{' '}
            (obligatorio).
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="consentMarketing" className="mt-0.5" />
          <span>Quiero recibir novedades y ofertas por correo (opcional, revocable).</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-rose-600 text-white text-sm py-2.5 rounded-lg hover:bg-rose-700 disabled:opacity-50"
      >
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>

      <p className="text-sm text-gray-500 text-center">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-rose-600 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
