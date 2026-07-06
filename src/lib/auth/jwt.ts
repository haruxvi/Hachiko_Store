import { EncryptJWT, jwtDecrypt } from 'jose';
import type { Role } from '@prisma/client';

export interface JWTPayload {
  sub: string;
  role: Role;
  email: string;
}

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

// Los tokens van CIFRADOS (JWE, AES-256-GCM en modo `dir`), no solo firmados.
// Diferencia práctica frente a un JWT firmado (JWS):
//   • Firmado  → cualquiera con la cookie puede leer el payload (rol, email, id)
//                en base64; solo no puede modificarlo sin romper la firma.
//   • Cifrado  → el contenido es opaco: interceptar la cookie (p. ej. con un
//                proxy) no revela nada, y alterarla la invalida (GCM autentica).
// En ambos casos NO se puede forjar un rol SELLER sin la clave del servidor.
const KEY_ALG = 'dir';
const ENC_ALG = 'A256GCM';

let cachedKey: Uint8Array | null = null;

// AES-256-GCM exige exactamente 32 bytes; JWT_SECRET es texto de longitud
// variable, así que derivamos la clave con SHA-256 (32 bytes fijos).
// crypto.subtle existe tanto en Node 20 como en el runtime Edge (middleware).
async function getKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;
  const raw = process.env['JWT_SECRET'];
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  cachedKey = new Uint8Array(digest);
  return cachedKey;
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  const key = await getKey();
  return new EncryptJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: KEY_ALG, enc: ENC_ALG })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRY)
    .encrypt(key);
}

export async function signRefreshToken(
  payload: JWTPayload,
  tokenVersion: number
): Promise<string> {
  const key = await getKey();
  return new EncryptJWT({ ...payload, type: 'refresh', ver: tokenVersion })
    .setProtectedHeader({ alg: KEY_ALG, enc: ENC_ALG })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRY)
    .encrypt(key);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const key = await getKey();
  // Fijar los algoritmos evita ataques de confusión (solo aceptamos dir/A256GCM)
  const { payload } = await jwtDecrypt(token, key, {
    keyManagementAlgorithms: [KEY_ALG],
    contentEncryptionAlgorithms: [ENC_ALG],
  });
  // Un refresh token cifrado con la misma clave no debe servir como access token
  if (payload['type'] !== 'access') {
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
  const key = await getKey();
  const { payload } = await jwtDecrypt(token, key, {
    keyManagementAlgorithms: [KEY_ALG],
    contentEncryptionAlgorithms: [ENC_ALG],
  });
  if (payload['type'] !== 'refresh') throw new Error('Not a refresh token');
  return {
    sub: payload['sub'] as string,
    role: payload['role'] as Role,
    email: payload['email'] as string,
    // Tokens emitidos antes de introducir `ver` cuentan como versión 0
    ver: typeof payload['ver'] === 'number' ? payload['ver'] : 0,
  };
}
