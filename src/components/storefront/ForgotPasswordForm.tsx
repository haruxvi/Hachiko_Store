'use client';

import { useState } from 'react';

export default function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email') }),
    });
    const json = await res.json();
    setLoading(false);

    if (json.ok) {
      setSent(true);
    } else {
      setError(json.error?.message ?? 'Error al enviar el correo');
    }
  }

  if (sent) {
    return (
      <div className="bg-mint border border-mint-deep/40 text-mint-ink text-sm rounded-lg px-4 py-4 leading-relaxed">
        Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.
        Revisa también tu carpeta de spam. El enlace es válido por 60 minutos.
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

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-soot mb-1">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input-hs !py-2.5 !text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
      </button>
    </form>
  );
}
