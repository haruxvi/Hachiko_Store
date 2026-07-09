import WhatsAppFab from './WhatsAppFab';

// Botón flotante de WhatsApp — el canal de soporte real de una pyme chilena.
// Enlace wa.me puro: abre el chat del cliente hacia la tienda. No usa API ni
// guarda sesión, así que no hay riesgo de baneo ni de fuga de credenciales.
//
// Este wrapper es un Server Component: lee el número desde el entorno (donde el
// acceso server-side funciona con noUncheckedIndexedAccess) y delega el render
// y el ocultamiento por ruta al hijo cliente. Solo se muestra si
// NEXT_PUBLIC_WHATSAPP_NUMBER está configurado (formato internacional sin +,
// p. ej. 56912345678).
export default function WhatsAppButton() {
  const number = process.env['NEXT_PUBLIC_WHATSAPP_NUMBER'];
  if (!number) return null;

  return <WhatsAppFab number={number} />;
}
