'use client';

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
  { icon: 'tag', label: 'Categorías', href: '/trastienda/categorias' },
  { icon: 'list', label: 'Inventario', href: '/trastienda/inventario' },
];

const THE_STORE: Item[] = [
  { icon: 'lock', label: 'Seguridad', href: '/trastienda/seguridad' },
  { icon: 'user', label: 'Mi cuenta', href: '/perfil' },
];

function SideItem({ item }: { item: Item }) {
  const pathname = usePathname();
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

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

export default function PanelSidebar({ email }: { email: string }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-sand bg-butter px-3.5 py-6">
      <div className="mb-3 flex items-center gap-2.5 border-b border-sand px-2.5 pb-5 pt-1">
        <Logo size={26} />
        <div>
          <div className="font-display text-base font-bold tracking-[-0.015em] text-soot">
            hachiko
          </div>
          <div className="mt-px text-[11px] font-normal text-taupe">trastienda</div>
        </div>
      </div>

      <GroupLabel>Día a día</GroupLabel>
      {DAY_TO_DAY.map((item) => (
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
  );
}
