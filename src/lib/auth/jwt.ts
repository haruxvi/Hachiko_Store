import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@prisma/client';

export interface JWTPayload {
  sub: string;
  role: Role;
  email: string;
}

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const raw = process.env['JWT_SECRET'];
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRY)
    .sign(getSecret());
}

export async function signRefreshToken(
  payload: JWTPayload,
  tokenVersion: number
): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh', ver: tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  // Un refresh token firmado con el mismo secreto no debe servir como access token
  if (payload['type'] !== undefined && payload['type'] !== 'access') {
    throw new Error('Not an access token');
  }
  return {
    sub: payload['sub'] as string,
    role: payload['role'] as Role,
    email: payload['email'] as string,
  };
}

export async function verifyRefreshToken(
  token: string
): Promise<JWTPayload & { ver: number }> {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload['type'] !== 'refresh') throw new Error('Not a refresh token');
  return {
    sub: payload['sub'] as string,
    role: payload['role'] as Role,
    email: payload['email'] as string,
    // Tokens emitidos antes de introducir `ver` cuentan como versión 0
    ver: typeof payload['ver'] === 'number' ? payload['ver'] : 0,
  };
}
