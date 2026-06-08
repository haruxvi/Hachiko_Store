import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env['DATA_ENCRYPTION_KEY'] = 'a'.repeat(64); // 32 bytes, test only
});

describe('PII encryption', () => {
  it('encrypts and decrypts correctly', async () => {
    const { encrypt, decrypt } = await import('@/src/lib/crypto/pii');
    const plaintext = 'Calle Los Aromos 123';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertexts each time (random IV)', async () => {
    const { encrypt } = await import('@/src/lib/crypto/pii');
    const c1 = encrypt('test');
    const c2 = encrypt('test');
    expect(c1).not.toBe(c2);
  });

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('@/src/lib/crypto/pii');
    const ciphertext = encrypt('sensitive data');
    const tampered = ciphertext.replace(/.$/, ciphertext.slice(-1) === 'a' ? 'b' : 'a');
    expect(() => decrypt(tampered)).toThrow();
  });
});
