'use client';

import { useState } from 'react';
import Link from 'next/link';
import { verifyEmailAction } from '@/src/actions/account';

// El token se consume con un click (POST vía server action), nunca al cargar
// la página: los escáneres de links del correo no pueden gastarlo.
export default function VerifyEmailButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');

  const handle = async () => {
    setState('loading');
    const result = await verifyEmailAction(token);
    setState(result.ok ? 'ok' : 'fail');
  };

  if (state === 'ok') {
    return (
      <div className="space-y-4">
        <div className="bg-mint border border-mint-deep/40 text-mint-ink text-sm rounded-lg px-4 py-4">
          ✓ Tu correo quedó verificado. ¡Gracias!
        </div>
        <Link
          href="/"
          className="btn-primary w-full"
        >
          Ir a la tienda
        </Link>
      </div>
    );
  }

  if (state === 'fail') {
    return (
      <div className="bg-alert/[0.08] border border-alert/30 text-alert text-sm rounded-lg px-4 py-4">
        El enlace expiró o ya fue usado. Puedes pedir uno nuevo desde tu perfil.
      </div>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={state === 'loading'}
      className="btn-primary w-full disabled:opacity-50"
    >
      {state === 'loading' ? 'Verificando…' : 'Confirmar mi correo'}
    </button>
  );
}
