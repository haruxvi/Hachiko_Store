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

  return (
    <div className="border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Doble factor de autenticación (2FA)</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {enabled ? 'Activo' : 'Inactivo'}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Protege tu cuenta con un código de 6 dígitos generado por una app de autenticación
        (Google Authenticator, Microsoft Authenticator, Authy u otra compatible).
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {!enabled && !qrDataUrl && (
        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-rose-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-rose-700 disabled:opacity-50"
        >
          {loading ? 'Generando...' : 'Activar doble factor'}
        </button>
      )}

      {!enabled && qrDataUrl && (
        <div className="space-y-4">
          <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-1">
            <li>Abre tu app de autenticación y escanea este código QR.</li>
            <li>Ingresa el código de 6 dígitos que te muestra la app para confirmar.</li>
          </ol>
          {/* data URL generada en el servidor — el secreto no pasa por terceros */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Código QR para app de autenticación" className="border rounded-lg" />
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer">¿No puedes escanear? Ingresa la clave manual</summary>
            <code className="block mt-2 break-all bg-gray-50 p-2 rounded">{uri}</code>
          </details>
          <form onSubmit={handleConfirm} className="flex gap-3">
            <input
              name="code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="000000"
              className="border rounded-lg px-3 py-2 text-sm tracking-widest text-center w-32"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-rose-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-rose-700 disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Confirmar y activar'}
            </button>
          </form>
        </div>
      )}

      {enabled && (
        <form onSubmit={handleDisable} className="space-y-3">
          <p className="text-sm text-gray-500">
            Para desactivar el doble factor, confirma con un código vigente de tu app:
          </p>
          <div className="flex gap-3">
            <input
              name="code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="000000"
              className="border rounded-lg px-3 py-2 text-sm tracking-widest text-center w-32"
            />
            <button
              type="submit"
              disabled={loading}
              className="border text-red-600 text-sm px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Desactivar 2FA'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
