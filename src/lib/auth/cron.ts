import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

// Autenticación compartida de los endpoints de cron (Vercel envía
// `Authorization: Bearer $CRON_SECRET`). Comparación en tiempo constante
// para no filtrar el secreto por timing.
export function requireCronAuth(headers: Headers): NextResponse | null {
  const secret = process.env['CRON_SECRET'];
  // Sin secreto configurado el endpoint queda cerrado, no abierto
  if (!secret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const authHeader = headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authHeader);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  return null;
}
