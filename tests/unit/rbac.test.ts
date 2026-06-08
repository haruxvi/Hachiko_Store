import { describe, it, expect } from 'vitest';
import { canManageCatalog, canDispatchOrders } from '@/src/lib/auth/rbac';

describe('RBAC helpers — dos roles: CLIENT y SELLER', () => {
  it('solo SELLER puede gestionar el catálogo', () => {
    expect(canManageCatalog('SELLER')).toBe(true);
    expect(canManageCatalog('CLIENT')).toBe(false);
  });

  it('solo SELLER puede despachar órdenes', () => {
    expect(canDispatchOrders('SELLER')).toBe(true);
    expect(canDispatchOrders('CLIENT')).toBe(false);
  });
});
