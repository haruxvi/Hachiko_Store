import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@prisma/client';

export interface JWTPayload {
  sub: string;
  role: Role;
  email: string;
}

const SECRET = new TextEncoder().encode(process.env['JWT_SECRET'] ?? '');
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRY)
    .sign(SECRET);
}

export async function signRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(SECRET);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return {
    sub: payload['sub'] as string,
    role: payload['role'] as Role,
    email: payload['email'] as string,
  };
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  if (payload['type'] !== 'refresh') throw new Error('Not a refresh token');
  return {
    sub: payload['sub'] as string,
    role: payload['role'] as Role,
    email: payload['email'] as string,
  };
}
