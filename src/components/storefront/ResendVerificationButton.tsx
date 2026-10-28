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
      setError(result.error ?? 'No pudimos enviar el correo. Inténtalo en unos minutos.');
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <p role="status" className="text-sm font-medium text-soot">
        Te enviamos el enlace. Revisa tu bandeja de entrada y también la de spam.
      </p>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        onClick={handle}
        disabled={state === 'loading'}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-soot underline decoration-rust decoration-2 underline-offset-4 hover:decoration-soot focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/40 disabled:opacity-60"
      >
        {state === 'loading' ? 'Enviando…' : 'Enviarme el enlace de verificación'}
      </button>
      {error && (
        <span role="alert" className="text-sm text-soot">
          {error}
        </span>
      )}
    </span>
  );
}
