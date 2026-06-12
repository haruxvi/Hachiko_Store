import Link from 'next/link';
import Shiba from '@/src/components/ui/Shiba';

export const metadata = { title: 'Página no encontrada — Hachiko' };

// 404 — el Shiba mira una caja vacía. Microcopy con humor, sin emojis.
export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6 py-12 sm:px-12">
      <div className="grid max-w-[1000px] items-center gap-12 lg:grid-cols-2 lg:gap-24">
        {/* Shiba + caja vacía */}
        <div className="relative flex flex-col items-center">
          <Shiba size={240} mood="idle" />
          <div className="relative -mt-3 h-20 w-[200px] rounded-b-[14px] border-2 border-t-0 border-soot bg-cream">
            <div className="absolute -top-1 left-[-2px] right-[-2px] h-2 rounded border-2 border-soot bg-snow" />
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 -rotate-6 rounded border border-sand bg-snow px-2 py-1 font-mono text-[11px] text-taupe">
              VACÍO
            </div>
          </div>
        </div>

        {/* Copy */}
        <div>
          <div className="price-mono text-7xl leading-none tracking-[-0.04em] text-rust sm:text-8xl">
            404
          </div>
          <h1 className="mb-4 mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-soot sm:text-4xl">
            Acá no hay nada que vender.
          </h1>
          <p className="mb-8 max-w-[420px] leading-[1.7] text-taupe">
            Buscamos en bodega, en la trastienda, en el cajón donde guardamos los stickers. La
            página que pediste no existe — o quizás fue al baño.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/catalogo" className="btn-primary">
              Volver al catálogo
            </Link>
            <a href="mailto:contacto@hachiko.cl" className="btn-link">
              Avisar que algo está roto
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
