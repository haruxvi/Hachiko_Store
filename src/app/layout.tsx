import type { Metadata } from 'next';
import WhatsAppButton from '@/src/components/storefront/WhatsAppButton';
import './globals.css';

const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Hachiko · Productos Coreanos',
    template: '%s', // las páginas ya incluyen "— Hachiko" donde corresponde
  },
  description:
    'Tienda online de productos coreanos auténticos. Snacks, skincare, papelería y merch K-pop con despacho nacional en Chile.',
  keywords: 'productos coreanos, kpop, skincare coreana, snacks coreanos, Chile',
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    siteName: 'Hachiko',
    title: 'Hachiko · Productos Coreanos',
    description:
      'Snacks, skincare, papelería y merch K-pop con despacho a todo Chile y retiro en tienda (Recoleta).',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased bg-white text-gray-900">
        {children}
        <WhatsAppButton />
      </body>
    </html>
  );
}
