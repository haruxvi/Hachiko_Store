'use client';

import { useState, useTransition } from 'react';
import { updateProfileAction } from '@/src/actions/account';

// Consentimiento de promociones (Ley 21.719: revocable en cualquier momento y tan
// fácil de quitar como de dar). El interruptor responde al instante; si el
// servidor falla, vuelve a su posición y lo dice.
export default function MarketingToggle({ initial, verified }: { initial: boolean; verified: boolean }) {
  const [on, setOn] = useState(initial);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setFailed(false);
    setMessage('');
    startTransition(async () => {
      const result = await updateProfileAction({ consentMarketing: next });
      if (!result.ok) {
        setOn(!next);
        setFailed(true);
        setMessage('No pudimos guardar tu preferencia. Inténtalo de nuevo.');
        return;
      }
      setMessage(next ? 'Listo, te avisaremos de promociones y novedades.' : 'Listo, ya no recibirás promociones.');
    });
  }

  return (
    <section aria-labelledby="mk-title" className="border-t border-sand pt-7">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 id="mk-title" className="font-display text-xl font-bold text-soot">
            Correos de Hachiko
          </h2>
          <p id="mk-desc" className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-taupe-deep">
            Promociones y novedades, de vez en cuando. Los correos de tus pedidos te llegan igual, actives esto o no.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="mk-title"
          aria-describedby="mk-desc"
          disabled={pending}
          onClick={toggle}
          className="group mt-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/40 disabled:cursor-wait"
        >
          <span
            className={`relative inline-block h-7 w-12 rounded-full border transition-colors duration-200 ${
              on ? 'border-soot bg-soot' : 'border-taupe-deep bg-sand'
            }`}
          >
            <span
              className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-snow shadow-soft transition-[left] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                on ? 'left-[calc(100%-1.4rem)]' : 'left-[0.15rem]'
              }`}
            />
          </span>
        </button>
      </div>
      <div aria-live="polite" className="min-h-6">
        {message && (
          <p role={failed ? 'alert' : undefined} className={`mt-3 text-sm text-soot ${failed ? 'font-semibold' : ''}`}>
            {message}
          </p>
        )}
        {on && !verified && !failed && (
          <p className="mt-2 text-sm text-taupe-deep">Para recibirlos, primero verifica tu correo en la sección Seguridad.</p>
        )}
      </div>
    </section>
  );
}
