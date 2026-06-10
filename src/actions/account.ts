'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { updateUserProfile, updateUserConsent } from '@/src/lib/services/customer.service';
import { UpdateProfileSchema } from '@/src/lib/validation/schemas';
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
