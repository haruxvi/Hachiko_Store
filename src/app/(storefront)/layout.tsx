import SiteHeader from '@/src/components/storefront/SiteHeader';
import SiteFooter from '@/src/components/storefront/SiteFooter';


export const dynamic = 'force-dynamic';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* 
        Clases añadidas a <main>:
        1. container: Centra el contenido y establece un ancho máximo responsivo.
        2. mx-auto: Margen horizontal automático para centrar el contenedor.
        3. px-4: Padding horizontal de 1rem (16px) para que el contenido no toque los bordes en móvil.
        4. md:px-6: Padding horizontal mayor en pantallas medianas y grandes.
      */}
      <main className="min-h-[60vh] container mx-auto px-4 md:px-6">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
