'use client';

import { useState } from 'react';

// Galería simple: imagen principal + miniaturas. El schema permite hasta 10
// imágenes por producto; antes solo se mostraba la primera.
export default function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-6xl text-gray-300">
        🛍️
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- URLs externas sin host fijo; next/image exige remotePatterns. Imagen LCP: priorizada */}
        <img
          src={images[selected]}
          alt={alt}
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto" role="listbox" aria-label="Imágenes del producto">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              role="option"
              aria-selected={i === selected}
              aria-label={`Imagen ${i + 1}`}
              className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 ${i === selected ? 'border-rose-400' : 'border-transparent hover:border-gray-300'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- miniaturas de las mismas URLs externas */}
              <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
