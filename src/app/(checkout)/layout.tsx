import { MinimalHeader } from '@/src/components/storefront/SiteHeader';
import { PageViewTracker } from '@/src/components/storefront/AnalyticsTracker';

// Checkout sin distracciones: nav minimal con solo logo y candado SSL.
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageViewTracker />
      <MinimalHeader />
      <main className="min-h-[70vh]">{children}</main>
    </>
  );
}
