import { cleanExpiredReservations } from '@/src/lib/services/inventory.service';
import { sweepAbandonedCheckouts } from '@/src/lib/services/analytics.service';
import { sendPickupReminders } from '@/src/lib/services/pickup.service';
import { requireCronAuth } from '@/src/lib/auth/cron';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req.headers);
  if (authError) return authError;

  // Las reservas vencidas ya no cuentan para el stock disponible; esto solo
  // las borra. Los checkouts sin pago tras 2 h se registran como abandonados
  // (embudo de la vista Conversión). Los pedidos listos para retiro reciben
  // recordatorios a los 3 y 10 días del plazo de retiro.
  const [result, abandoned, pickupReminders] = await Promise.all([
    cleanExpiredReservations(),
    sweepAbandonedCheckouts(),
    sendPickupReminders(),
  ]);
  return NextResponse.json({ ...result, checkoutsAbandoned: abandoned, pickupRemindersSent: pickupReminders });
}
