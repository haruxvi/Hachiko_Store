import Link from 'next/link';
import Logo from '@/src/components/ui/Logo';
import Icon from '@/src/components/ui/Icon';
import CartIndicator from '@/src/components/storefront/CartIndicator';
import { getCategories } from '@/src/lib/services/catalog.service';
import { getSession } from '@/src/lib/auth/session';

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Logo size={28} />
      <span className="font-display text-[22px] font-bold tracking-[-0.02em] text-soot">
        hachiko
      </span>
      <span className="hangul ml-1 mt-1.5 text-[13px] text-taupe">하치코</span>
    </Link>
  );
}

/** Nav minimal para checkout: solo logo y candado SSL, sin distracciones. */
export function MinimalHeader() {
  return (
    <nav className="flex items-center gap-8 border-b border-sand bg-butter px-6 py-[18px] sm:px-12">
      <Wordmark />
      <div className="ml-auto flex items-center gap-2 text-[13px] text-taupe">
        <Icon name="lock" size={14} /> Compra segura · SSL
      </div>
    </nav>
  );
}

export default async function SiteHeader() {
  const [categories, session] = await Promise.all([getCategories(), getSession()]);

  return (
    <nav className="flex flex-wrap items-center gap-4 border-b border-sand bg-butter px-6 py-[18px] sm:gap-8 sm:px-12">
      <Wordmark />

      <ul className="hidden items-center gap-7 text-sm font-semibold lg:flex lg:ml-6">
        {categories.slice(0, 5).map((c) => (
          <li key={c.id}>
            <Link href={`/catalogo?categoria=${c.slug}`} className="text-soot hover:text-rust">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>

      <div className="ml-auto flex items-center gap-1.5">
        <form
          method="get"
          action="/catalogo"
          className="hidden items-center gap-2 rounded-full border border-sand bg-snow px-3.5 py-2 md:flex"
        >
          <Icon name="search" size={16} className="text-taupe" />
          <input
            type="search"
            name="q"
            placeholder="Buscar mochi, sheet mask…"
            aria-label="Buscar productos"
            className="w-44 bg-transparent text-[13px] text-soot placeholder:text-taupe focus:outline-none"
          />
        </form>

        {/* Atajo solo de navegación: el rol sale de la sesión verificada en el
            servidor (JWE), no de estado del cliente. El acceso real a /trastienda
            lo siguen controlando el middleware, el layout del panel y cada acción. */}
        {session?.role === 'SELLER' && (
          <Link
            href="/trastienda"
            aria-label="Ir a la trastienda"
            className="btn-outline btn-sm !px-2.5 sm:!px-3.5"
          >
            <Icon name="grid" size={16} />
            <span className="hidden sm:inline">Trastienda</span>
          </Link>
        )}
        <Link
          href={session ? '/perfil' : '/login'}
          aria-label={session ? 'Mi cuenta' : 'Iniciar sesión'}
          className="btn-ghost btn-sm !p-2"
        >
          <Icon name="user" size={20} />
        </Link>
        <CartIndicator />
      </div>
    </nav>
  );
}
