'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { updateUserProfile, updateUserConsent } from '@/src/lib/services/customer.service';
import {
  sendVerificationEmail,
  verifyEmailWithToken,
} from '@/src/lib/services/account-token.service';
import { UpdateProfileSchema, VerifyEmailSchema } from '@/src/lib/validation/schemas';
import { rateLimit } from '@/src/lib/rate-limit';
import type { z } from 'zod';

export async function updateProfileAction(
  input: z.infer<typeof UpdateProfileSchema>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inválido' };

  await updateUserProfile(session.sub, {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
  });

  if (parsed.data.consentMarketing !== undefined) {
    await updateUserConsent(session.sub, parsed.data.consentMarketing);
  }

  revalidatePath('/perfil');
  return { ok: true };
}

// Reenviar el correo de verificación desde el perfil (con límite: dispara emails)
export async function resendVerificationAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const limited = await rateLimit(`resend-verify:${session.sub}`, 3, 15 * 60 * 1000);
  if (!limited.allowed) {
    return { ok: false, error: 'Ya enviamos varios correos. Revisa tu bandeja de spam y espera unos minutos.' };
  }

  await sendVerificationEmail(session.sub);
  return { ok: true };
}

// Confirmar el email desde el link del correo. Es un botón (POST), no un GET:
// los escáneres de links de los clientes de correo no pueden consumir el token
export async function verifyEmailAction(token: string): Promise<{ ok: boolean }> {
  const parsed = VerifyEmailSchema.safeParse({ token });
  if (!parsed.success) return { ok: false };

  const ok = await verifyEmailWithToken(parsed.data.token);
  if (ok) revalidatePath('/perfil');
  return { ok };
}
