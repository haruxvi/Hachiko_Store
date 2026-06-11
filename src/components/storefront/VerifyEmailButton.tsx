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
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-4">
          ✓ Tu correo quedó verificado. ¡Gracias!
        </div>
        <Link
          href="/"
          className="block text-center bg-rose-600 text-white text-sm py-2.5 rounded-lg hover:bg-rose-700"
        >
          Ir a la tienda
        </Link>
      </div>
    );
  }

  if (state === 'fail') {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-4">
        El enlace expiró o ya fue usado. Puedes pedir uno nuevo desde tu perfil.
      </div>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={state === 'loading'}
      className="w-full bg-rose-600 text-white text-sm py-2.5 rounded-lg hover:bg-rose-700 disabled:opacity-50"
    >
      {state === 'loading' ? 'Verificando…' : 'Confirmar mi correo'}
    </button>
  );
}
