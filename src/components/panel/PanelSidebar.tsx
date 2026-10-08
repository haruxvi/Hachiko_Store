'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/src/components/ui/Logo';
import Icon, { type IconName } from '@/src/components/ui/Icon';
import LogoutButton from '@/src/components/storefront/LogoutButton';

interface Item {
  icon: IconName;
  label: string;
  href: string;
  exact?: boolean;
}

// Voz de tienda boutique, no SaaS: labels en sentence case, grupos en
// Fraunces italic, activo con barra rust de 2px (no bold).
const DAY_TO_DAY: Item[] = [
  { icon: 'grid', label: 'Resumen', href: '/trastienda', exact: true },
  { icon: 'box', label: 'Por despachar', href: '/trastienda/ordenes' },
  { icon: 'package', label: 'Productos', href: '/trastienda/productos' },
  { icon: 'list', label: 'Carga masiva', href: '/trastienda/productos/importar' },
  { icon: 'tag', label: 'Categorías', href: '/trastienda/categorias' },
  { icon: 'list', label: 'Inventario', href: '/trastienda/inventario' },
];

// Subsistema de análisis de datos y ML. Estas vistas leen el plano analítico
// que el pipeline de Python precalcula (ver docs/machine-learning.md).
const INTELLIGENCE: Item[] = [
  { icon: 'sliders', label: 'Métricas', href: '/trastienda/metricas' },
  { icon: 'arrow', label: 'Demanda', href: '/trastienda/demanda' },
  { icon: 'truck', label: 'Qué reponer', href: '/trastienda/reponer' },
  { icon: 'box', label: 'Logística', href: '/trastienda/logistica' },
  { icon: 'heart', label: 'Recomendaciones', href: '/trastienda/recomendaciones' },
  { icon: 'eye', label: 'Clientes', href: '/trastienda/clientes' },
  { icon: 'filter', label: 'Conversión', href: '/trastienda/conversion' },
  { icon: 'bell', label: 'Riesgo', href: '/trastienda/riesgo' },
  { icon: 'settings', label: 'Modelos', href: '/trastienda/modelos' },
  { icon: 'list', label: 'Reporte', href: '/trastienda/reporte' },
];

const THE_STORE: Item[] = [
  // Vuelta a la vitrina pública; `exact` evita que '/' quede activo en todo el panel.
  { icon: 'store', label: 'Ver tienda', href: '/', exact: true },
  { icon: 'mail', label: 'Promociones', href: '/trastienda/promociones' },
  { icon: 'lock', label: 'Seguridad', href: '/trastienda/seguridad' },
  { icon: 'user', label: 'Mi cuenta', href: '/perfil' },
];

function SideItem({ item }: { item: Item }) {
  const pathname = usePathname();
  const insideImport =
    pathname === '/trastienda/productos/importar' ||
    pathname.startsWith('/trastienda/productos/importar/');
  const active =
    !(item.href === '/trastienda/productos' && insideImport) &&
    (item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-3 rounded-chip py-[9px] pl-4 pr-3.5 text-sm font-medium transition ${
        active ? 'bg-cream text-soot' : 'text-taupe hover:bg-cream/60 hover:text-soot'
      }`}
    >
      {active && (
        <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-sm bg-rust" />
      )}
      <Icon name={item.icon} size={17} stroke={active ? 1.6 : 1.5} />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="editorial px-4 pb-1.5 pt-4 text-xs text-taupe">{children}</div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={26} />
      <div>
        <div className="font-display text-base font-bold tracking-[-0.015em] text-soot">hachiko</div>
        <div className="mt-px text-[11px] font-normal text-taupe">trastienda</div>
      </div>
    </div>
  );
}

// En escritorio la barra lateral queda fija a la izquierda. En celular y tablet
// ocupaba media pantalla: ahora se esconde tras un botón "Menú" y se abre como
// panel deslizante (se cierra al elegir una sección, con Escape o tocando fuera).
export default function PanelSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Al cambiar de sección, el menú se cierra (ajuste durante el render, sin efecto).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sand bg-butter px-4 py-2.5 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="panel-nav"
          className="inline-flex min-h-11 items-center gap-2 rounded-chip px-3 text-sm font-semibold text-soot hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/40"
        >
          <Icon name="menu" size={18} /> Menú
        </button>
      </header>

      {open && (
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-soot/30 lg:hidden" />
      )}

    <aside
      id="panel-nav"
      aria-label="Secciones de la trastienda"
      inert={!desktop && !open}
      className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col gap-1 overflow-y-auto border-r border-sand bg-butter px-3.5 py-6 transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 ${
        open ? 'translate-x-0 shadow-soft' : '-translate-x-full'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2.5 border-b border-sand px-2.5 pb-5 pt-1">
        <Brand />
        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
          className="inline-flex h-11 w-11 items-center justify-center rounded-chip text-taupe-deep hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/40 lg:hidden"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <GroupLabel>Día a día</GroupLabel>
      {DAY_TO_DAY.map((item) => (
        <SideItem key={item.href} item={item} />
      ))}

      <GroupLabel>Inteligencia</GroupLabel>
      {INTELLIGENCE.map((item) => (
        <SideItem key={item.href} item={item} />
      ))}

      <GroupLabel>La tienda</GroupLabel>
      {THE_STORE.map((item) => (
        <SideItem key={item.href} item={item} />
      ))}

      <div className="mt-auto flex flex-col gap-1 px-4 pt-4">
        <Link href="/perfil" className="truncate text-xs font-normal text-taupe hover:text-soot">
          {email}
        </Link>
        <LogoutButton className="text-left text-xs font-normal text-taupe hover:text-alert hover:underline" />
      </div>
    </aside>
    </>
  );
}
