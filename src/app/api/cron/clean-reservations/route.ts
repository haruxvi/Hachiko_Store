import { cleanExpiredReservations } from '@/src/lib/services/inventory.service';
import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

export async function GET(req: NextRequest) {
  const secret = process.env['CRON_SECRET'];
  // Sin secreto configurado el endpoint queda cerrado, no abierto
  if (!secret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authHeader);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const result = await cleanExpiredReservations();
  return NextResponse.json(result);
}
