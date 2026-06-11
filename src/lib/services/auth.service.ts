import { db } from '@/src/lib/db';
import { decrypt } from '@/src/lib/crypto/pii';
import { signAccessToken, signRefreshToken } from '@/src/lib/auth/jwt';
import { verifyTotpCode } from '@/src/lib/auth/totp';
import { writeAudit } from './audit.service';
import type { Role } from '@prisma/client';
import type { RegisterSchema, LoginSchema } from '@/src/lib/validation/schemas';
import type { z } from 'zod';

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

// Hash de relleno para igualar el tiempo de respuesta cuando el email no existe
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (dummyHash) return dummyHash;
  const argon2 = await import('argon2');
  dummyHash = await argon2.hash('dummy-password-for-timing', {
    type: argon2.argon2id,
    ...ARGON2_OPTIONS,
  });
  return dummyHash;
}

export type AuthResult =
  | { ok: true; accessToken: string; refreshToken: string; role: Role }
  | { ok: false; error: { code: string; message: string } };

export async function registerUser(
  input: z.infer<typeof RegisterSchema>,
  ip?: string
): Promise<AuthResult> {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return { ok: false, error: { code: 'EMAIL_EXISTS', message: 'El email ya está registrado' } };
  }

  const argon2 = await import('argon2');
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    ...ARGON2_OPTIONS,
  });

  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      consentEssential: input.consentEssential,
      consentMarketing: input.consentMarketing,
      consentVersion: input.consentVersion,
      consentAt: new Date(),
      consentIp: ip,
    },
  });

  await writeAudit({ actorId: user.id, actorRole: 'CLIENT', action: 'REGISTER', ip });

  // Correo de verificación: si falla no bloquea el registro (se puede reenviar
  // desde el perfil)
  const { sendVerificationEmail } = await import('./account-token.service');
  await sendVerificationEmail(user.id).catch(() => undefined);

  const payload = { sub: user.id, role: user.role, email: user.email };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload, user.tokenVersion),
  ]);

  return { ok: true, accessToken, refreshToken, role: user.role };
}

// "Continuar como invitado": crea una cuenta CLIENT real con contraseña
// aleatoria imposible de adivinar. Así el resto del sistema no cambia (RBAC,
// auditoría, derechos ARCO y verificación de dueño en pagos siguen intactos)
// y el comprador puede reclamar la cuenta después vía "recuperar contraseña".
export async function registerGuest(email: string, ip?: string): Promise<AuthResult> {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // No se reutiliza la cuenta existente: entregar sesión solo con el email
    // permitiría tomar el historial de otra persona
    return {
      ok: false,
      error: {
        code: 'EMAIL_EXISTS',
        message: 'Este correo ya está registrado. Inicia sesión o usa "recuperar contraseña".',
      },
    };
  }

  const { randomBytes } = await import('node:crypto');
  const argon2 = await import('argon2');
  const passwordHash = await argon2.hash(randomBytes(32).toString('hex'), {
    type: argon2.argon2id,
    ...ARGON2_OPTIONS,
  });

  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      isGuest: true,
      consentEssential: true,
      consentMarketing: false,
      consentVersion: 'v1.0-2026',
      consentAt: new Date(),
      consentIp: ip,
    },
  });

  await writeAudit({
    actorId: user.id,
    actorRole: 'CLIENT',
    action: 'REGISTER',
    ip,
    metadata: { guest: true },
  });

  const payload = { sub: user.id, role: user.role, email: user.email };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload, user.tokenVersion),
  ]);

  return { ok: true, accessToken, refreshToken, role: user.role };
}

export async function loginUser(
  input: z.infer<typeof LoginSchema>,
  ip?: string,
  userAgent?: string
): Promise<AuthResult> {
  const user = await db.user.findUnique({ where: { email: input.email } });

  if (!user || user.deletedAt) {
    // Verificación de relleno: sin esto, la respuesta inmediata delata qué emails existen
    const argon2 = await import('argon2');
    await argon2.verify(await getDummyHash(), input.password).catch(() => false);
    return { ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      ok: false,
      error: { code: 'ACCOUNT_LOCKED', message: 'Cuenta bloqueada temporalmente' },
    };
  }

  const argon2 = await import('argon2');
  const valid = await argon2.verify(user.passwordHash, input.password);

  if (!valid) {
    const failedLogins = user.failedLogins + 1;
    const lockedUntil =
      failedLogins >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_DURATION_MS) : null;

    await db.user.update({
      where: { id: user.id },
      data: { failedLogins, lockedUntil },
    });

    if (lockedUntil) {
      await writeAudit({ actorId: user.id, action: 'ACCOUNT_LOCKED', ip, userAgent });
    }

    await writeAudit({ actorId: user.id, action: 'LOGIN_FAILED', ip, userAgent });
    return { ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } };
  }

  // Segundo factor: solo se solicita DESPUÉS de validar la contraseña,
  // para no revelar qué cuentas tienen 2FA activo
  if (user.totpEnabledAt && user.totpSecret) {
    if (!input.totpCode) {
      return {
        ok: false,
        error: { code: 'TOTP_REQUIRED', message: 'Ingresa el código de tu app de autenticación' },
      };
    }

    const totpValid = verifyTotpCode(decrypt(user.totpSecret), user.email, input.totpCode);
    if (!totpValid) {
      // Un código TOTP errado cuenta como intento fallido: protege contra fuerza bruta del segundo factor
      const failedLogins = user.failedLogins + 1;
      const lockedUntil =
        failedLogins >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_DURATION_MS) : null;

      await db.user.update({
        where: { id: user.id },
        data: { failedLogins, lockedUntil },
      });

      if (lockedUntil) {
        await writeAudit({ actorId: user.id, action: 'ACCOUNT_LOCKED', ip, userAgent });
      }

      await writeAudit({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        ip,
        userAgent,
        metadata: { factor: 'TOTP' },
      });
      return { ok: false, error: { code: 'INVALID_TOTP', message: 'Código de autenticación inválido' } };
    }
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await writeAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'LOGIN',
    ip,
    userAgent,
  });

  const payload = { sub: user.id, role: user.role, email: user.email };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload, user.tokenVersion),
  ]);

  return { ok: true, accessToken, refreshToken, role: user.role };
}

export async function getUserProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      consentMarketing: true,
      totpEnabledAt: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  return {
    ...user,
    phone: user.phone ? decrypt(user.phone) : null,
  };
}

// ─── Doble factor (TOTP) ─────────────────────────────────────

export async function startTotpEnrollment(userId: string): Promise<{ uri: string }> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId, deletedAt: null },
    select: { email: true, totpEnabledAt: true },
  });
  if (user.totpEnabledAt) {
    throw new Error('El doble factor ya está activo');
  }

  const { generateTotpSecret, totpUri } = await import('@/src/lib/auth/totp');
  const { encrypt } = await import('@/src/lib/crypto/pii');

  const secret = generateTotpSecret();
  // Se guarda cifrado pero NO habilitado: queda pendiente hasta confirmar un código válido
  await db.user.update({
    where: { id: userId },
    data: { totpSecret: encrypt(secret), totpEnabledAt: null },
  });

  return { uri: totpUri(secret, user.email) };
}

export async function confirmTotpEnrollment(
  userId: string,
  code: string,
  ip?: string
): Promise<{ ok: boolean }> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId, deletedAt: null },
    select: { email: true, totpSecret: true, totpEnabledAt: true },
  });
  if (!user.totpSecret || user.totpEnabledAt) return { ok: false };

  if (!verifyTotpCode(decrypt(user.totpSecret), user.email, code)) {
    return { ok: false };
  }

  await db.user.update({
    where: { id: userId },
    data: { totpEnabledAt: new Date() },
  });
  await writeAudit({ actorId: userId, action: 'TOTP_ENABLED', targetType: 'User', targetId: userId, ip });
  return { ok: true };
}

export async function disableTotp(
  userId: string,
  code: string,
  ip?: string
): Promise<{ ok: boolean }> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId, deletedAt: null },
    select: { email: true, totpSecret: true, totpEnabledAt: true },
  });
  if (!user.totpSecret || !user.totpEnabledAt) return { ok: false };

  // Desactivar exige un código vigente: una sesión robada no puede bajar el 2FA sin el teléfono
  if (!verifyTotpCode(decrypt(user.totpSecret), user.email, code)) {
    return { ok: false };
  }

  await db.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabledAt: null },
  });
  await writeAudit({ actorId: userId, action: 'TOTP_DISABLED', targetType: 'User', targetId: userId, ip });
  return { ok: true };
}
