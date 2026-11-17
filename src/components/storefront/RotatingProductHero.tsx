'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type HeroProduct = { slug: string; name: string; image: string };

export default function RotatingProductHero({ products }: { products: HeroProduct[] }) {
  const [slide, setSlide] = useState<{ current: number; previous: number | null }>({
    current: 0,
    previous: null,
  });
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<number[]>([]);
  const currentIndex = slide.current;

  useEffect(() => {
    if (products.length - failed.length < 2 || paused) return;
    let cancelled = false;
    let loading = false;
    let preload: HTMLImageElement | null = null;
    let loadTimeout: number | undefined;
    const timer = window.setInterval(() => {
      if (loading || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        return;
      const choices = products
        .map((_, index) => index)
        .filter((index) => index !== currentIndex && !failed.includes(index));
      if (!choices.length) return;
      const next = choices[Math.floor(Math.random() * choices.length)]!;
      loading = true;
      const image = new Image();
      preload = image;
      let settled = false;
      const finish = (loaded: boolean) => {
        if (settled || cancelled) return;
        settled = true;
        loading = false;
        window.clearTimeout(loadTimeout);
        if (loaded) setSlide({ current: next, previous: currentIndex });
        else setFailed((current) => (current.includes(next) ? current : [...current, next]));
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      loadTimeout = window.setTimeout(() => finish(false), 8000);
      image.src = products[next]!.image;
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(loadTimeout);
      if (preload) {
        preload.onload = null;
        preload.onerror = null;
      }
    };
  }, [currentIndex, failed, paused, products]);

  useEffect(() => {
    if (slide.previous === null) return;
    const timer = window.setTimeout(() => {
      setSlide(({ current }) => ({ current, previous: null }));
    }, 850);
    return () => window.clearTimeout(timer);
  }, [slide.previous]);

  const current = failed.includes(slide.current) ? null : products[slide.current];
  const previous = slide.previous === null ? null : products[slide.previous];

  if (!current) {
    return (
      <div className="flex h-full items-center justify-center bg-cream px-8 text-center text-soot">
        Explora los productos disponibles en el catálogo.
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full bg-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {previous && (
        // eslint-disable-next-line @next/next/no-img-element -- Las fotos del catálogo usan URLs externas.
        <img
          src={previous.image}
          alt=""
          aria-hidden="true"
          className="hs-product-exit absolute inset-0 h-full w-full object-contain"
        />
      )}
      <Link
        key={current.slug}
        href={`/producto/${current.slug}`}
        aria-label={`Ver ${current.name}`}
        className="hs-product-enter absolute inset-0 block h-full w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Las fotos del catálogo usan URLs externas. */}
        <img
          src={current.image}
          alt={current.name}
          className="h-full w-full object-contain"
          onError={() => {
            setFailed((seen) =>
              seen.includes(slide.current) ? seen : [...seen, slide.current],
            );
            const next = products.findIndex(
              (_, index) => index !== slide.current && !failed.includes(index),
            );
            if (next >= 0) setSlide({ current: next, previous: null });
          }}
        />
      </Link>
    </div>
  );
}
