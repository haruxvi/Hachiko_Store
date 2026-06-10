'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Paso 2: la contraseña fue válida y la cuenta tiene 2FA — se pide el código
  const [totpRequired, setTotpRequired] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const totpCode = (fd.get('totpCode') as string) || undefined;

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fd.get('email'),
        password: fd.get('password'),
        ...(totpCode ? { totpCode } : {}),
      }),
    });
    const json = await res.json();

    if (json.ok) {
      router.push(json.data.role === 'SELLER' ? '/trastienda' : '/');
      router.refresh();
      return;
    }

    if (json.error?.code === 'TOTP_REQUIRED') {
      setTotpRequired(true);
      setLoading(false);
      return;
    }

    setError(json.error?.message ?? 'Error al iniciar sesión');
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          readOnly={totpRequired}
          className="w-full border rounded-lg px-3 py-2 text-sm read-only:bg-gray-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          readOnly={totpRequired}
          className="w-full border rounded-lg px-3 py-2 text-sm read-only:bg-gray-50"
        />
      </div>

      {totpRequired && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <label className="block text-sm font-medium text-gray-800 mb-1">
            Código de verificación
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Esta cuenta tiene doble factor activo. Ingresa el código de 6 dígitos de tu app de
            autenticación.
          </p>
          <input
            name="totpCode"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            autoComplete="one-time-code"
            placeholder="000000"
            className="w-full border rounded-lg px-3 py-2 text-sm tracking-widest text-center"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-rose-600 text-white text-sm py-2.5 rounded-lg hover:bg-rose-700 disabled:opacity-50"
      >
        {loading ? 'Ingresando...' : totpRequired ? 'Verificar código' : 'Iniciar sesión'}
      </button>

      <p className="text-sm text-gray-500 text-center">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="text-rose-600 hover:underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
