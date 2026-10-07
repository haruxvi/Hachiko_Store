import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';
import { unsubscribe } from '@/src/lib/services/newsletter.service';

// Baja en un clic (RFC 8058), para la cabecera List-Unsubscribe de los correos de
// promociones. Gmail y Yahoo hacen un POST aquí cuando la persona toca "Anular
// suscripción" junto al remitente. El token firmado identifica a quién dar de
// baja; sin él (o alterado) no pasa nada.
export async function POST(request: NextRequest) {
  const limited = await rateLimit(`newsletter-oneclick:${clientIpFrom(request.headers)}`, 30, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ ok: false }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
  }

  const done = await unsubscribe(request.nextUrl.searchParams.get('token') ?? '');
  return NextResponse.json({ ok: done }, { status: done ? 200 : 400 });
}

// Algunos clientes abren esta URL en el navegador en vez de hacer POST: se los
// lleva a la página con el botón de baja (un GET nunca da de baja por sí solo,
// porque los escáneres de links también hacen GET).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  // Se usa la URL pública configurada y no la del request: detrás de un proxy o en
  // un contenedor, el origen del request puede ser la dirección interna
  // (p. ej. http://0.0.0.0:3000), que no existe para el navegador.
  const url = new URL('/newsletter/baja', process.env['NEXT_PUBLIC_APP_URL'] ?? request.nextUrl.origin);
  url.searchParams.set('token', token);
  return NextResponse.redirect(url, 303);
}
