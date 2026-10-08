'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <form method="post" onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-alert/[0.08] border border-alert/30 text-alert text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-soot mb-1">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          readOnly={totpRequired}
          className="input-hs !py-2.5 !text-sm read-only:bg-cream"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-soot">Contraseña</label>
          <Link href="/recuperar" className="text-xs text-rust-ink hover:underline">
            ¿La olvidaste?
          </Link>
        </div>
        
        {/* Contenedor relativo para posicionar el botón dentro del campo */}
        <div className="relative flex items-center">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            readOnly={totpRequired}
            className="input-hs !py-2.5 !pr-10 !text-sm read-only:bg-cream"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-3 text-taupe hover:text-taupe focus:outline-none"
          >
            {showPassword ? (
              /* Ícono de Ojo Abierto / Ocultar */
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.52 10.52 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              /* Ícono de Ojo Cerrado / Mostrar */
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.074 4.028 5.006 7 9.964 7 4.958 0 8.91-2.972 9.964-7-1.074-4.028-5.006-7-9.964-7-4.958 0-8.91 2.972-9.964 7Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {totpRequired && (
        <div className="rounded-lg border border-sky-deep/40 bg-sky p-4">
          <label className="block text-sm font-medium text-soot mb-1">
            Código de verificación
          </label>
          <p className="text-xs text-taupe mb-2">
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
            className="input-hs !py-2.5 !text-sm tracking-widest text-center"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? 'Ingresando...' : totpRequired ? 'Verificar código' : 'Iniciar sesión'}
      </button>

      <p className="text-sm text-taupe text-center">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="text-rust-ink hover:underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}