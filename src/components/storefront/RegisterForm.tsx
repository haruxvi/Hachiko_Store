'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

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
      // No se inicia sesión automáticamente (anti-enumeración): se confirma y
      // se invita a entrar por el login con la contraseña recién creada.
      setDone(true);
      return;
    }

    setError(json.error?.message ?? 'Error al crear la cuenta');
    setLoading(false);
  }

  if (done) {
    return (
      <div className="rounded-card border border-sand bg-cream px-5 py-6 text-center">
        <p className="font-display text-lg font-bold text-soot">¡Cuenta lista!</p>
        <p className="mt-2 text-sm leading-relaxed text-taupe">
          Si el correo estaba disponible, creamos tu cuenta y te enviamos un enlace para verificarla.
          Ya puedes iniciar sesión con tu contraseña.
        </p>
        <Link href="/login" className="btn-primary mt-4 inline-flex justify-center">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-alert/[0.08] border border-alert/30 text-alert text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-soot mb-1">Nombre</label>
          <input
            name="firstName"
            required
            maxLength={100}
            autoComplete="given-name"
            className="input-hs !py-2.5 !text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-soot mb-1">Apellido</label>
          <input
            name="lastName"
            required
            maxLength={100}
            autoComplete="family-name"
            className="input-hs !py-2.5 !text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-soot mb-1">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input-hs !py-2.5 !text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-soot mb-1">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input-hs !py-2.5 !text-sm"
        />
        <p className="text-xs text-taupe mt-1">
          Mínimo 8 caracteres, con mayúscula, minúscula y un número. Evita números
          consecutivos o repetidos (ej. 123 o 111).
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <label className="flex items-start gap-2 text-sm text-soot">
          <input type="checkbox" name="consentEssential" required className="mt-0.5" />
          <span>
            Acepto el tratamiento de mis datos personales necesario para operar mi cuenta y mis
            compras, según la{' '}
            <Link href="/legal/privacidad" className="text-rust-ink hover:underline" target="_blank">
              Política de Privacidad
            </Link>{' '}
            (obligatorio).
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-soot">
          <input type="checkbox" name="consentMarketing" className="mt-0.5" />
          <span>Quiero recibir novedades y ofertas por correo (opcional, revocable).</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>

      <p className="text-sm text-taupe text-center">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-rust-ink hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
