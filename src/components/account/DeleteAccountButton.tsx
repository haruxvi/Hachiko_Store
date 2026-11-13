'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Derecho de supresión (Ley 21.719). Antes era un enlace a /api/me/account, que
// solo acepta DELETE: la navegación respondía 405 y la solicitud nunca se hacía.
// Se confirma en la misma página (con motivo opcional) antes de llamar a la API.
export default function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/me/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    setLoading(false);
    if (!json?.ok) {
      setError('No pudimos registrar la solicitud. Inténtalo de nuevo o escríbenos.');
      return;
    }
    setDone(json.message ?? 'Cuenta eliminada. Los datos serán purgados en 30 días.');
    // La API ya cerró la sesión: se vuelve a la tienda sin datos de la cuenta
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 2500);
  }

  if (done) {
    return <p className="text-sm font-medium text-soot">{done}</p>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-alert hover:underline"
      >
        Solicitar eliminación de cuenta →
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <label htmlFor="delete-reason" className="block text-sm font-medium text-soot">
        ¿Por qué te vas? (opcional)
      </label>
      <textarea
        id="delete-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={3}
        className="input-hs !text-sm"
      />
      {error && <p className="text-sm text-alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="btn btn-sm min-h-11 bg-alert text-snow hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Eliminando…' : 'Sí, eliminar mi cuenta'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="btn-link text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
