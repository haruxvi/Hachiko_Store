'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  startTotpEnrollmentAction,
  confirmTotpEnrollmentAction,
  disableTotpAction,
} from '@/src/actions/twofactor';

export default function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [uri, setUri] = useState('');

  async function handleStart() {
    setLoading(true);
    setError('');
    const result = await startTotpEnrollmentAction();
    if (result.ok) {
      setQrDataUrl(result.qrDataUrl);
      setUri(result.uri);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const result = await confirmTotpEnrollmentAction(fd.get('code') as string);
    if (result.ok) {
      setQrDataUrl('');
      setUri('');
      router.refresh();
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleDisable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const result = await disableTotpAction(fd.get('code') as string);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  // Presentación de marca (ítem de la sección Seguridad del perfil). La lógica de
  // activación/desactivación de arriba no cambia.
  const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/40';
  const codeInput =
    'input-hs w-36 text-center font-mono text-lg tracking-[0.35em] placeholder:tracking-[0.35em]';

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${enabled ? 'bg-mint-deep' : 'border-2 border-taupe-deep/60'}`}
          />
          <div>
            <h3 className="text-[15px] font-semibold text-soot">Doble factor</h3>
            <p className="mt-1 max-w-[42ch] text-sm leading-relaxed text-taupe-deep">
              {enabled
                ? 'Activo. Al iniciar sesión te pediremos también el código de tu app de autenticación.'
                : 'Además de tu contraseña, te pediremos un código de 6 dígitos de una app como Google Authenticator o Authy.'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-input border border-alert/30 bg-alert/[0.06] px-4 py-3 text-sm text-soot">
          {error}
        </p>
      )}

      {!enabled && !qrDataUrl && (
        <button
          onClick={handleStart}
          disabled={loading}
          className={`btn-primary btn-sm mt-4 min-h-11 disabled:opacity-60 ${focusRing}`}
        >
          {loading ? 'Generando código…' : 'Activar doble factor'}
        </button>
      )}

      {!enabled && qrDataUrl && (
        <div className="mt-5 space-y-4 rounded-[18px] border border-sand bg-snow p-5">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-soot">
            <li>Abre tu app de autenticación y escanea este código.</li>
            <li>Escribe el código de 6 dígitos que te muestra la app.</li>
          </ol>
          {/* data URL generada en el servidor — el secreto no pasa por terceros */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Código QR para tu app de autenticación" className="rounded-input border border-sand" />
          <details className="text-sm text-taupe-deep">
            <summary className="cursor-pointer">¿No puedes escanearlo? Usa la clave manual</summary>
            <code className="mt-2 block break-all rounded-input bg-cream p-2 text-xs text-soot">{uri}</code>
          </details>
          <form method="post" onSubmit={handleConfirm} className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="totp-confirm">Código de 6 dígitos</label>
            <input
              id="totp-confirm"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="000000"
              className={codeInput}
            />
            <button type="submit" disabled={loading} className={`btn-primary btn-sm min-h-11 disabled:opacity-60 ${focusRing}`}>
              {loading ? 'Verificando…' : 'Confirmar y activar'}
            </button>
          </form>
        </div>
      )}

      {enabled && (
        <details className="mt-3 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-taupe-deep underline decoration-taupe underline-offset-4 hover:text-soot">
            Desactivar doble factor
          </summary>
          <form method="post" onSubmit={handleDisable} className="mt-2 space-y-3">
            <p className="text-sm text-taupe-deep">Confirma con un código vigente de tu app:</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="sr-only" htmlFor="totp-disable">Código de 6 dígitos</label>
              <input
                id="totp-disable"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="000000"
                className={codeInput}
              />
              <button type="submit" disabled={loading} className={`btn-outline btn-sm min-h-11 disabled:opacity-60 ${focusRing}`}>
                {loading ? 'Verificando…' : 'Desactivar'}
              </button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}
