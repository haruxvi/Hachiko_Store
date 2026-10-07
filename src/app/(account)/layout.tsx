import SiteHeader from '@/src/components/storefront/SiteHeader';
import SiteFooter from '@/src/components/storefront/SiteFooter';

// Las páginas de cuenta (/perfil, /pedidos, /datos) usan el mismo header y footer
// que la tienda, para poder volver al catálogo (o a la trastienda, si es vendedor)
// sin depender del botón "atrás". El acceso a estas rutas lo controla el middleware.
export const dynamic = 'force-dynamic';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* Sin container propio: cada página de cuenta ya define su ancho. */}
      <main className="min-h-[60vh]">{children}</main>
      <SiteFooter />
    </>
  );
}
