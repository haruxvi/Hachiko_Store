'use server';

import { cookies, headers } from 'next/headers';
import { registerGuest } from '@/src/lib/services/auth.service';
import { accessCookieOptions, refreshCookieOptions } from '@/src/lib/auth/session';
import { GuestCheckoutSchema } from '@/src/lib/validation/schemas';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';
import type { z } from 'zod';

// Mismo límite que el registro normal: crear cuentas dispara escrituras y correos
const GUEST_LIMIT = 5; // por IP por minuto
const GUEST_WINDOW_MS = 60 * 1000;

export async function startGuestCheckoutAction(
  input: z.infer<typeof GuestCheckoutSchema>
): Promise<{ ok: boolean; error?: string }> {
  const parsed = GuestCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const headerStore = await headers();
  const ip = clientIpFrom(headerStore);

  const limited = rateLimit(`guest:${ip}`, GUEST_LIMIT, GUEST_WINDOW_MS);
  if (!limited.allowed) {
    return { ok: false, error: 'Demasiados intentos, espera un momento' };
  }

  const result = await registerGuest(parsed.data.email, ip);
  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }

  // Sesión real de CLIENT: el resto del flujo (checkout, pagos, pedidos)
  // funciona exactamente igual que con una cuenta registrada
  const cookieStore = await cookies();
  const accessOpts = accessCookieOptions();
  const refreshOpts = refreshCookieOptions();
  cookieStore.set(accessOpts.name, result.accessToken, accessOpts.options);
  cookieStore.set(refreshOpts.name, result.refreshToken, refreshOpts.options);

  return { ok: true };
}
