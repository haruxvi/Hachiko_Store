'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { updateUserConsent } from '@/src/lib/services/customer.service';
import { UpdateProfileSchema } from '@/src/lib/validation/schemas';
import { db } from '@/src/lib/db';
import { encrypt } from '@/src/lib/crypto/pii';
import type { z } from 'zod';

export async function updateProfileAction(
  input: z.infer<typeof UpdateProfileSchema>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inválido' };

  const data: Record<string, unknown> = {};
  if (parsed.data.firstName !== undefined) data['firstName'] = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) data['lastName'] = parsed.data.lastName;
  if (parsed.data.phone !== undefined) data['phone'] = encrypt(parsed.data.phone);

  if (Object.keys(data).length > 0) {
    await db.user.update({ where: { id: session.sub }, data });
  }

  if (parsed.data.consentMarketing !== undefined) {
    await updateUserConsent(session.sub, parsed.data.consentMarketing);
  }

  revalidatePath('/perfil');
  return { ok: true };
}
