import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const hex = process.env['DATA_ENCRYPTION_KEY'] ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv(12B):tag(16B):ciphertext — all hex
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, tagHex, encHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}

export function encryptOptional(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return encrypt(value);
}

export function decryptOptional(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return decrypt(value);
}
