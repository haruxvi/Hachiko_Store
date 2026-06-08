import { cleanExpiredReservations } from '@/src/lib/services/inventory.service';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const result = await cleanExpiredReservations();
  return NextResponse.json(result);
}
