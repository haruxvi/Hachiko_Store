'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfileAction } from '@/src/actions/account';

// "Tus datos": se leen como una ficha y se editan en el mismo lugar (sin modal ni
// otra página). Al guardar, la confirmación aparece donde estaba el botón y el
// carnet se actualiza con el nombre nuevo.
const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/40';

export default function ProfileDetails({
  firstName,
  lastName,
  phone,
}: {
  firstName: string;
  lastName: string;
  phone: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nextPhone = String(fd.get('phone') ?? '').trim();
    setError('');
    startTransition(async () => {
      const result = await updateProfileAction({
        firstName: String(fd.get('firstName') ?? ''),
        lastName: String(fd.get('lastName') ?? ''),
        // Vacío = no cambiar el teléfono guardado.
        phone: nextPhone || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? 'No pudimos guardar tus datos. Inténtalo de nuevo.');
        return;
      }
      setEditing(false);
      setSaved(true);
      router.refresh();
    });
  }

  const rows: [string, string | null][] = [
    ['Nombre', firstName || null],
    ['Apellido', lastName || null],
    ['Teléfono', phone],
  ];

  return (
    <section aria-labelledby="datos-title" className="rounded-[22px] border border-sand bg-snow p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <h2 id="datos-title" className="font-display text-xl font-bold text-soot">
          Tus datos
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSaved(false);
            }}
            className={`btn-outline btn-sm min-h-11 ${focusRing}`}
          >
            Editar datos
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <dl className="mt-5 divide-y divide-sand/70">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-6 py-3 first:pt-0">
                <dt className="text-sm text-taupe-deep">{label}</dt>
                <dd className={`text-right text-[15px] ${value ? 'font-medium text-soot' : 'text-taupe-deep'}`}>
                  {value ?? (label === 'Teléfono' ? 'Sin teléfono' : 'Sin completar')}
                </dd>
              </div>
            ))}
          </dl>
          {saved && (
            <p role="status" className="mt-4 text-sm font-medium text-soot">
              Datos guardados.
            </p>
          )}
        </>
      ) : (
        <form method="post" onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-soot">Nombre</span>
              <input name="firstName" defaultValue={firstName} required maxLength={100} autoComplete="given-name" className="input-hs" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-soot">Apellido</span>
              <input name="lastName" defaultValue={lastName} required maxLength={100} autoComplete="family-name" className="input-hs" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-soot">Teléfono</span>
            <input
              name="phone"
              type="tel"
              defaultValue={phone ?? ''}
              placeholder="+56 9 1234 5678"
              autoComplete="tel"
              aria-describedby="phone-hint"
              className="input-hs"
            />
            <span id="phone-hint" className="mt-1.5 block text-sm text-taupe-deep">
              Solo lo usamos para coordinar tus despachos.
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-input border border-alert/30 bg-alert/[0.06] px-4 py-3 text-sm text-soot">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <button type="submit" disabled={pending} className={`btn-primary min-h-11 disabled:opacity-60 ${focusRing}`}>
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setError('');
              }}
              className={`btn-ghost min-h-11 ${focusRing}`}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
