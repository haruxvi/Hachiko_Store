import type { Metadata } from 'next';
import Logo from '@/src/components/ui/Logo';

export const metadata: Metadata = {
  title: 'Sin conexión — Hachiko',
  robots: { index: false, follow: false },
};

// Página que muestra el service worker (public/sw.js) cuando no hay internet.
// Estilos en línea a propósito: debe verse bien aunque el CSS del sitio todavía
// no esté guardado en el dispositivo. Sin JavaScript: "Reintentar" es un link.
export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        background: '#FEF7E4',
        color: '#3D2F25',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <Logo size={56} />
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Sin conexión</h1>
      <p style={{ maxWidth: 320, margin: 0, color: '#A8907A', fontSize: 15, lineHeight: 1.5 }}>
        Parece que no hay internet. Revisa tu conexión y vuelve a intentarlo: tu carrito sigue guardado.
      </p>
      {/* <a> y no <Link>: "Reintentar" debe hacer una recarga completa que vuelva
          a pasar por la red, no una navegación interna de React. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        style={{
          marginTop: 8,
          padding: '12px 22px',
          borderRadius: 12,
          background: '#EC9C4A',
          color: '#FFFFFF',
          fontWeight: 600,
          fontSize: 15,
          textDecoration: 'none',
        }}
      >
        Reintentar
      </a>
    </main>
  );
}
