import type { Metadata } from 'next';
import { Zen_Maru_Gothic, Quicksand, JetBrains_Mono, Fraunces } from 'next/font/google';
import WhatsAppButton from '@/src/components/storefront/WhatsAppButton';
import './globals.css';

// Sistema tipográfico Hachiko:
// Zen Maru Gothic (display), Quicksand (UI), JetBrains Mono (precios/SKUs),
// Fraunces italic (acento editorial, racionado).
const zenMaru = Zen_Maru_Gothic({
  weight: ['500', '700'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['italic'],
  variable: '--font-editorial',
  display: 'swap',
});

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
    <html
      lang="es"
      className={`${zenMaru.variable} ${quicksand.variable} ${jetbrains.variable} ${fraunces.variable}`}
    >
      <body>
        {children}
        <WhatsAppButton />
      </body>
    </html>
  );
}
