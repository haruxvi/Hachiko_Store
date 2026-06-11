import { db } from '@/src/lib/db';
import { generateActionToken, hashActionToken } from '@/src/lib/crypto/tokens';
import { sendEmail, passwordResetEmail, verifyEmailEmail } from '@/src/lib/email';
import { writeAudit } from './audit.service';
import type { ActionTokenType } from '@prisma/client';

// Flujos por correo con token de un solo uso: recuperar contraseña y
// verificar email. El token viaja solo en el link; la BD guarda su hash.

const RESET_TTL_MS = 60 * 60 * 1000; // 60 min
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

async function issueToken(userId: string, type: ActionTokenType, ttlMs: number): Promise<string> {
  const { token, tokenHash } = generateActionToken();

  // Un token nuevo invalida los anteriores del mismo tipo: solo el último
  // link enviado funciona, lo que acota la ventana de ataque
  await db.$transaction([
    db.actionToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.actionToken.create({
      data: { userId, type, tokenHash, expiresAt: new Date(Date.now() + ttlMs) },
    }),
  ]);

  return token;
}

async function consumeToken(token: string, type: ActionTokenType): Promise<string | null> {
  const record = await db.actionToken.findUnique({
    where: { tokenHash: hashActionToken(token) },
  });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  // updateMany con usedAt: null hace el consumo atómico: dos requests
  // simultáneos con el mismo token no pueden usarlo dos veces
  const updated = await db.actionToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (updated.count === 0) return null;

  return record.userId;
}

// ─── Recuperación de contraseña ──────────────────────────

export async function requestPasswordReset(email: string, ip?: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email } });

  // Si el email no existe NO se revela: la respuesta del endpoint es idéntica.
  // Aquí simplemente no se envía nada.
  if (!user || user.deletedAt) return;

  const token = await issueToken(user.id, 'PASSWORD_RESET', RESET_TTL_MS);
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const resetUrl = `${appUrl}/restablecer?token=${token}`;

  await sendEmail({ to: user.email, ...passwordResetEmail(resetUrl) });
  await writeAudit({ actorId: user.id, action: 'PASSWORD_RESET_REQUESTED', ip });
}

export async function resetPassword(
  token: string,
  newPassword: string,
  ip?: string
): Promise<boolean> {
  const userId = await consumeToken(token, 'PASSWORD_RESET');
  if (!userId) return false;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return false;

  const argon2 = await import('argon2');
  const passwordHash = await argon2.hash(newPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      // Cambiar la clave cierra la sesión en todos los dispositivos y
      // desbloquea la cuenta (el dueño legítimo recuperó el control)
      tokenVersion: { increment: 1 },
      failedLogins: 0,
      lockedUntil: null,
      // Un invitado que fija contraseña reclama su cuenta: deja de ser guest.
      // Probar el control del buzón también verifica el email.
      isGuest: false,
      emailVerified: new Date(),
    },
  });

  await writeAudit({
    actorId: userId,
    action: 'PASSWORD_RESET',
    targetType: 'User',
    targetId: userId,
    ip,
  });
  return true;
}

// ─── Verificación de email ───────────────────────────────

export async function sendVerificationEmail(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.emailVerified) return;

  const token = await issueToken(userId, 'EMAIL_VERIFY', VERIFY_TTL_MS);
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const verifyUrl = `${appUrl}/verificar-email?token=${token}`;

  await sendEmail({ to: user.email, ...verifyEmailEmail(verifyUrl) });
}

export async function verifyEmailWithToken(token: string): Promise<boolean> {
  const userId = await consumeToken(token, 'EMAIL_VERIFY');
  if (!userId) return false;

  await db.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });

  await writeAudit({
    actorId: userId,
    action: 'EMAIL_VERIFIED',
    targetType: 'User',
    targetId: userId,
  });
  return true;
}
