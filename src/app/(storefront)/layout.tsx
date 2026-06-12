import SiteHeader from '@/src/components/storefront/SiteHeader';
import SiteFooter from '@/src/components/storefront/SiteFooter';

// El header consulta categorías y sesión: todo el grupo se renderiza en
// runtime. El build no debe depender de una base de datos viva.
export const dynamic = 'force-dynamic';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[60vh]">{children}</main>
      <SiteFooter />
    </>
  );
}
