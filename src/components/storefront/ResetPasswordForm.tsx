'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ResetPasswordForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;
    const confirm = fd.get('confirm') as string;

    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json();
    setLoading(false);

    if (json.ok) {
      setDone(true);
    } else {
      setError(json.error?.message ?? 'No se pudo restablecer la contraseña');
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-4">
          Tu contraseña fue actualizada y cerramos la sesión en todos tus dispositivos.
        </div>
        <Link
          href="/login"
          className="block text-center bg-rose-600 text-white text-sm py-2.5 rounded-lg hover:bg-rose-700"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña nueva
        </label>
        <input
          id="password"
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

      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
          Repite la contraseña
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-rose-600 text-white text-sm py-2.5 rounded-lg hover:bg-rose-700 disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Guardar contraseña nueva'}
      </button>
    </form>
  );
}
