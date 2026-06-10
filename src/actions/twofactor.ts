'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { getSession } from '@/src/lib/auth/session';
import {
  startTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
} from '@/src/lib/services/auth.service';

const TotpCodeSchema = z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos');

export async function startTotpEnrollmentAction(): Promise<
  { ok: true; uri: string; qrDataUrl: string } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  try {
    const { uri } = await startTotpEnrollment(session.sub);
    // El QR se genera en el servidor y viaja como data URL: el secreto nunca
    // pasa por servicios de terceros
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 1 });
    return { ok: true, uri, qrDataUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al iniciar enrolamiento' };
  }
}

export async function confirmTotpEnrollmentAction(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const parsed = TotpCodeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Código inválido' };

  const result = await confirmTotpEnrollment(session.sub, parsed.data);
  if (!result.ok) return { ok: false, error: 'Código incorrecto. Revisa tu app e intenta de nuevo.' };

  revalidatePath('/perfil');
  return { ok: true };
}

export async function disableTotpAction(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const parsed = TotpCodeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Código inválido' };

  const result = await disableTotp(session.sub, parsed.data);
  if (!result.ok) return { ok: false, error: 'Código incorrecto. No se desactivó el doble factor.' };

  revalidatePath('/perfil');
  return { ok: true };
}
