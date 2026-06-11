import { describe, it, expect } from 'vitest';
import { calculateShipping, shippingLabel, trackingUrlFor } from '@/src/lib/shipping';

describe('calculateShipping', () => {
  it('charges 3990 for delivery orders below 50000', () => {
    expect(calculateShipping(30000, 'STARKEN')).toBe(3990);
    expect(calculateShipping(49999, 'CORREOS_CHILE')).toBe(3990);
  });

  it('is free for delivery orders of 50000 or more', () => {
    expect(calculateShipping(50000, 'STARKEN')).toBe(0);
    expect(calculateShipping(100000, 'CORREOS_CHILE')).toBe(0);
  });

  it('is always free for store pickup, regardless of subtotal', () => {
    expect(calculateShipping(1000, 'PICKUP')).toBe(0);
    expect(calculateShipping(100000, 'PICKUP')).toBe(0);
  });

  it('defaults to delivery pricing when no method is given', () => {
    expect(calculateShipping(30000)).toBe(3990);
    expect(calculateShipping(50000)).toBe(0);
  });
});

describe('shippingLabel', () => {
  it('returns the customer-facing label of the chosen method', () => {
    expect(shippingLabel('STARKEN')).toBe('Starken');
    expect(shippingLabel('CORREOS_CHILE')).toBe('Correos de Chile');
    expect(shippingLabel('PICKUP')).toBe('Retiro en tienda');
  });
});

describe('trackingUrlFor', () => {
  it('builds the carrier tracking URL with the tracking number escaped', () => {
    const url = trackingUrlFor('STARKEN', 'ABC 123');
    expect(url).toContain('starken.cl');
    expect(url).toContain('ABC%20123');
  });

  it('returns null for pickup (no carrier) or missing tracking number', () => {
    expect(trackingUrlFor('PICKUP', 'ABC123')).toBeNull();
    expect(trackingUrlFor('STARKEN', null)).toBeNull();
  });
});
