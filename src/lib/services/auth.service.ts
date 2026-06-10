import { db } from '@/src/lib/db';
import { encrypt, decrypt } from '@/src/lib/crypto/pii';
import { signAccessToken, signRefreshToken } from '@/src/lib/auth/jwt';
import { writeAudit } from './audit.service';
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
  | { ok: true; accessToken: string; refreshToken: string }
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

  const payload = { sub: user.id, role: user.role, email: user.email };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ]);

  return { ok: true, accessToken, refreshToken };
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
    signRefreshToken(payload),
  ]);

  return { ok: true, accessToken, refreshToken };
}

export async function getUserProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      consentMarketing: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  return {
    ...user,
    phone: user.phone ? decrypt(user.phone) : null,
  };
}
