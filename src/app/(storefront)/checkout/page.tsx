import { redirect } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import CheckoutForm from '@/src/components/storefront/CheckoutForm';

export default async function CheckoutPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/checkout');

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">Datos de envío y pago</h1>
      <CheckoutForm />
    </div>
  );
}
