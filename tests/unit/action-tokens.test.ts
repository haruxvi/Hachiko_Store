import { describe, it, expect } from 'vitest';
import { generateActionToken, hashActionToken } from '@/src/lib/crypto/tokens';

describe('action tokens', () => {
  it('generates a 64-char hex token with its SHA-256 hash', () => {
    const { token, tokenHash } = generateActionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashActionToken(token));
  });

  it('generates unique tokens on each call', () => {
    const a = generateActionToken();
    const b = generateActionToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it('hashing is deterministic and one-way (hash differs from token)', () => {
    const { token } = generateActionToken();
    expect(hashActionToken(token)).toBe(hashActionToken(token));
    expect(hashActionToken(token)).not.toBe(token);
  });
});
