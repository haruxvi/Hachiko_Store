'use client';

import { useEffect, useSyncExternalStore } from 'react';

const KEY = 'hachiko-from-app';
const noop = () => () => {};
const readFlag = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

// Si la compra empezó en la app, al confirmar el pago se vuelve a la app sola
// (el navegador seguro se cierra al abrir el enlace hachiko://) y además queda
// un botón por si el teléfono pide confirmación.
export default function BackToApp({ orderNumber }: { orderNumber: number }) {
  // sessionStorage es un estado externo: en el servidor es "no", en el navegador se lee.
  const fromApp = useSyncExternalStore(noop, readFlag, () => false);
  const href = `hachiko://pedido-confirmado?n=${orderNumber}`;

  useEffect(() => {
    if (!fromApp) return;
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    const t = setTimeout(() => window.location.assign(href), 1200);
    return () => clearTimeout(t);
  }, [fromApp, href]);

  if (!fromApp) return null;
  return (
    <div className="mx-auto mb-10 max-w-[420px] rounded-card bg-butter px-6 py-5 text-center">
      <p className="text-[15px] font-semibold text-soot">Compraste desde la app</p>
      <a href={href} className="btn-primary mt-3 w-full">Volver a la app</a>
    </div>
  );
}
