import { describe, it, expect } from 'vitest';
import { calculateShipping } from '@/src/lib/services/order.service';

describe('calculateShipping', () => {
  it('charges 3990 for orders below 50000', () => {
    expect(calculateShipping(30000)).toBe(3990);
    expect(calculateShipping(49999)).toBe(3990);
  });

  it('is free for orders of 50000 or more', () => {
    expect(calculateShipping(50000)).toBe(0);
    expect(calculateShipping(100000)).toBe(0);
  });
});
