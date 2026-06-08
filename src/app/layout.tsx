import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hachiko · Productos Coreanos',
  description:
    'Tienda online de productos coreanos auténticos. Snacks, skincare, papelería y merch K-pop con despacho nacional en Chile.',
  keywords: 'productos coreanos, kpop, skincare coreana, snacks coreanos, Chile',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased bg-white text-gray-900">{children}</body>
    </html>
  );
}
