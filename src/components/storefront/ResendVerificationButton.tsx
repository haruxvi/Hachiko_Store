'use client';

import { useState } from 'react';
import { resendVerificationAction } from '@/src/actions/account';

export default function ResendVerificationButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'sent'>('idle');
  const [error, setError] = useState('');

  const handle = async () => {
    setState('loading');
    setError('');
    const result = await resendVerificationAction();
    if (result.ok) {
      setState('sent');
    } else {
      setError(result.error ?? 'No se pudo enviar');
      setState('idle');
    }
  };

  if (state === 'sent') {
    return <p className="text-xs text-green-600">✓ Correo enviado, revisa tu bandeja (y el spam).</p>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handle}
        disabled={state === 'loading'}
        className="text-xs text-rose-600 hover:underline disabled:opacity-50"
      >
        {state === 'loading' ? 'Enviando…' : 'Reenviar correo de verificación'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  );
}
