import { describe, it, expect } from 'vitest';
import { canAccessPII, canManageCatalog, canViewOrders, canRefund } from '@/src/lib/auth/rbac';

describe('RBAC helpers', () => {
  it('only ADMIN can access PII', () => {
    expect(canAccessPII('ADMIN')).toBe(true);
    expect(canAccessPII('SELLER')).toBe(false);
    expect(canAccessPII('CLIENT')).toBe(false);
  });

  it('SELLER and ADMIN can manage catalog', () => {
    expect(canManageCatalog('ADMIN')).toBe(true);
    expect(canManageCatalog('SELLER')).toBe(true);
    expect(canManageCatalog('CLIENT')).toBe(false);
  });

  it('SELLER and ADMIN can view orders', () => {
    expect(canViewOrders('ADMIN')).toBe(true);
    expect(canViewOrders('SELLER')).toBe(true);
    expect(canViewOrders('CLIENT')).toBe(false);
  });

  it('only ADMIN can refund', () => {
    expect(canRefund('ADMIN')).toBe(true);
    expect(canRefund('SELLER')).toBe(false);
    expect(canRefund('CLIENT')).toBe(false);
  });
});
