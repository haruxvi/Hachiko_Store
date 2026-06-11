// Botón flotante de WhatsApp — el canal de soporte real de una pyme chilena.
// Solo se muestra si NEXT_PUBLIC_WHATSAPP_NUMBER está configurado
// (formato internacional sin +, p. ej. 56912345678).
export default function WhatsAppButton() {
  const number = process.env['NEXT_PUBLIC_WHATSAPP_NUMBER'];
  if (!number) return null;

  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full bg-[#25D366] shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      style={{ width: 52, height: 52 }}
    >
      <svg viewBox="0 0 32 32" width="28" height="28" fill="#fff" aria-hidden>
        <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.6.8 5 2.3 7L4 29l7.3-2.3c1.5.8 3.1 1.2 4.7 1.2 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.8c-1.5 0-3-.4-4.3-1.1l-.3-.2-4.3 1.4 1.4-4.2-.2-.3c-1.3-1.6-2-3.6-2-5.6 0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.5 10-9.9 10zm5.4-7.3c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1c-.3-.1-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1s0-.5.1-.6c.1-.1.3-.3.4-.5.1-.1.2-.3.3-.5.1-.2 0-.4 0-.5s-.7-1.6-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.5 1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.5-.4z" />
      </svg>
    </a>
  );
}
