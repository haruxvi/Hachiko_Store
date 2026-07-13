'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Un único IntersectionObserver compartido por todas las instancias. Aunque haya
// muchos elementos revelables en la home, el navegador ejecuta un solo callback:
// costo mínimo, sin listeners de scroll (que forzarían trabajo en cada frame).
let sharedObserver: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, () => void>();

function ensureObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (sharedObserver) return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = callbacks.get(entry.target);
        if (cb) cb();
        callbacks.delete(entry.target);
        obs.unobserve(entry.target); // se revela una sola vez y se deja de observar
      }
    },
    // Se dispara un poco antes del borde inferior para que la aparición se sienta
    // natural y no "de golpe" justo en el filo del viewport.
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
  );
  return sharedObserver;
}

type RevealProps = {
  children: ReactNode;
  /** Retardo en ms para escalonar (stagger) elementos hermanos. */
  delay?: number;
  className?: string;
};

// Envuelve contenido de la home para que aparezca con un fundido + desplazamiento
// suave al entrar en viewport. Decisiones de robustez y rendimiento:
//  - Sin JS el contenido queda visible: el estado oculto solo se "arma"
//    (data-armed) tras montar, así nunca queda contenido invisible si el bundle
//    falla o tarda.
//  - Respeta prefers-reduced-motion mostrando sin animar.
//  - Solo anima opacity/transform → trabajo en el compositor, sin reflow ni CLS.
//  - No usa estado de React: alterna atributos por el ref, sin re-renders.
export default function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const observer = ensureObserver();
    if (prefersReduced || !observer) {
      el.setAttribute('data-shown', '');
      return;
    }

    el.setAttribute('data-armed', '');
    callbacks.set(el, () => el.setAttribute('data-shown', ''));
    observer.observe(el);

    return () => {
      callbacks.delete(el);
      observer.unobserve(el);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
