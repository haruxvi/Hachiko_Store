import { randomBytes, createHash } from 'node:crypto';

// Tokens de un solo uso para flujos por correo. El token viaja en el link;
// en la BD se guarda SOLO su hash SHA-256: quien lea la base no puede usarlos.

export function generateActionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashActionToken(token) };
}

export function hashActionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
