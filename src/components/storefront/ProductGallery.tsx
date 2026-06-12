'use client';

import { useState } from 'react';

// Galería del detalle: thumbnails verticales al costado + imagen principal
// cuadrada con indicador "n / total". El schema permite hasta 10 imágenes.
export default function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return (
      <div className="ph ph-sand aspect-square w-full rounded-3xl">
        <span className="ph-label">foto · {alt.toLowerCase().slice(0, 32)}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[72px_1fr]">
      {images.length > 1 && (
        <div
          className="order-2 flex gap-3 overflow-x-auto sm:order-1 sm:flex-col sm:overflow-visible"
          role="listbox"
          aria-label="Imágenes del producto"
        >
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              role="option"
              aria-selected={i === selected}
              aria-label={`Imagen ${i + 1}`}
              className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[10px] ${
                i === selected ? 'border-2 border-rust' : 'border border-sand hover:border-taupe'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- miniaturas de las mismas URLs externas */}
              <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div
        className={`relative order-1 aspect-square overflow-hidden rounded-3xl bg-cream sm:order-2 ${
          images.length === 1 ? 'sm:col-span-2' : ''
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URLs externas sin host fijo; next/image exige remotePatterns. Imagen LCP: priorizada */}
        <img
          src={images[selected]}
          alt={alt}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
        {images.length > 1 && (
          <div className="absolute bottom-5 right-5 rounded-full bg-snow px-3 py-2 text-xs font-semibold text-taupe shadow-soft">
            {selected + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );
}
