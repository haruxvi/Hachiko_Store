import { MinimalHeader } from '@/src/components/storefront/SiteHeader';

// Checkout sin distracciones: nav minimal con solo logo y candado SSL.
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MinimalHeader />
      <main className="min-h-[70vh]">{children}</main>
    </>
  );
}
