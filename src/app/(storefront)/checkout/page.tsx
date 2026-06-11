import { getSession } from '@/src/lib/auth/session';
import { getDefaultShippingAddress } from '@/src/lib/services/customer.service';
import CheckoutForm from '@/src/components/storefront/CheckoutForm';
import GuestCheckoutGate from '@/src/components/storefront/GuestCheckoutGate';

export default async function CheckoutPage() {
  const session = await getSession();

  // Sin sesión no se expulsa al login: se ofrece iniciar sesión, registrarse
  // o continuar como invitado (que crea sesión y vuelve a esta misma página)
  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8">Antes de pagar</h1>
        <GuestCheckoutGate />
      </div>
    );
  }

  // Precarga la última dirección usada: menos fricción en la recompra
  const savedAddress = await getDefaultShippingAddress(session.sub);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">Entrega y pago</h1>
      <CheckoutForm savedAddress={savedAddress} />
    </div>
  );
}
