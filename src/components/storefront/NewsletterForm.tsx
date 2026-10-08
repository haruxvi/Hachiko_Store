'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { subscribeNewsletterAction, type SubscribeState } from '@/src/actions/newsletter';

const initial: SubscribeState = { status: 'idle', message: '' };

// Suscripción a promociones desde el footer. Ley 21.719: el texto informa para qué
// se usa el correo antes de enviarlo, y la suscripción solo se activa cuando la
// persona confirma desde su casilla (doble opt-in).
export default function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletterAction, initial);

  if (state.status === 'ok') {
    return (
      <p role="status" className="max-w-[300px] rounded-input border border-sand bg-snow px-3.5 py-3 text-sm text-soot">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="max-w-[300px]">
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="tu@correo.cl"
          aria-label="Email para recibir promociones"
          className="input-hs flex-1"
        />
        <button type="submit" disabled={pending} className="btn-primary btn-sm !px-3.5 !py-2.5 disabled:opacity-60">
          {pending ? '…' : 'Suscribir'}
        </button>
      </div>
      {/* Campo trampa: invisible para personas, los bots lo llenan. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <p className="mt-2 text-xs leading-relaxed text-taupe">
        Recibirás promociones de Hachiko por correo. Te pediremos confirmar y puedes darte de baja cuando
        quieras. Ver{' '}
        <Link href="/legal/privacidad" className="underline hover:text-soot">
          Política de Privacidad
        </Link>
        .
      </p>
      {state.status === 'error' && (
        <p role="alert" className="mt-2 text-xs text-rust-ink">
          {state.message}
        </p>
      )}
    </form>
  );
}
