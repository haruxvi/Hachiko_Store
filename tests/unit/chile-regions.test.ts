import { describe, expect, it } from 'vitest';
import {
  CHILE_REGIONS,
  REGION_NAMES,
  communesOf,
  isValidCommune,
  matchCommune,
  matchRegion,
} from '@/src/lib/chile-regions';
import { CheckoutSchema, deliveryAddressIssues } from '@/src/lib/validation/schemas';

describe('regiones y comunas de Chile', () => {
  it('tiene las 16 regiones y las 346 comunas, sin repetir', () => {
    expect(REGION_NAMES).toHaveLength(16);
    const all = CHILE_REGIONS.flatMap((r) => r.communes);
    expect(all).toHaveLength(346);
    expect(new Set(all).size).toBe(346);
  });

  it('cada región tiene la cantidad oficial de comunas', () => {
    const counts = Object.fromEntries(CHILE_REGIONS.map((r) => [r.name, r.communes.length]));
    expect(counts).toEqual({
      'Arica y Parinacota': 4, Tarapacá: 7, Antofagasta: 9, Atacama: 9, Coquimbo: 15, Valparaíso: 38,
      'Región Metropolitana': 52, "O'Higgins": 33, Maule: 30, Ñuble: 21, Biobío: 33, Araucanía: 32,
      'Los Ríos': 12, 'Los Lagos': 30, Aysén: 10, Magallanes: 11,
    });
  });

  it('una comuna solo vale dentro de su región', () => {
    expect(isValidCommune('Región Metropolitana', 'Providencia')).toBe(true);
    expect(isValidCommune('Valparaíso', 'Providencia')).toBe(false);
    expect(communesOf('Región inventada')).toEqual([]);
  });

  it('reconoce direcciones antiguas escritas a mano', () => {
    expect(matchRegion('Metropolitana')).toBe('Región Metropolitana');
    expect(matchRegion('region de valparaiso')).toBe('Valparaíso');
    expect(matchRegion('Narnia')).toBeNull();
    expect(matchCommune('Región Metropolitana', 'nunoa')).toBe('Ñuñoa');
    expect(matchCommune('Región Metropolitana', 'Viña del Mar')).toBeNull();
  });
});

describe('dirección de despacho', () => {
  const base = { street: 'Av. Siempre Viva', number: '742' };

  it('exige región y comuna de la lista', () => {
    expect(deliveryAddressIssues({ ...base, region: 'Región Metropolitana', commune: 'Providencia' })).toEqual([]);
    expect(deliveryAddressIssues({ ...base, region: 'Metropolitana', commune: 'Providencia' })).toEqual([
      { field: 'region', message: 'Elige una región de la lista' },
    ]);
    expect(deliveryAddressIssues({ ...base, region: 'Biobío', commune: 'Providencia' })).toEqual([
      { field: 'commune', message: 'Elige una comuna de la región seleccionada' },
    ]);
    expect(deliveryAddressIssues({ ...base, region: 'Biobío' })).toEqual([
      { field: 'commune', message: 'Requerido para despacho a domicilio' },
    ]);
  });

  it('el servidor rechaza una comuna que no es de la región y no la pide en retiro', () => {
    const order = {
      paymentProvider: 'WEBPAY' as const,
      items: [{ productId: 'p1', quantity: 1 }],
      shippingAddress: { fullName: 'Ana', phone: '+56912345678', ...base, region: 'Maule', commune: 'Ñuñoa' },
    };
    expect(CheckoutSchema.safeParse({ ...order, shippingMethod: 'STARKEN' }).success).toBe(false);
    expect(CheckoutSchema.safeParse({ ...order, shippingMethod: 'PICKUP' }).success).toBe(true);
    expect(
      CheckoutSchema.safeParse({
        ...order,
        shippingMethod: 'STARKEN',
        shippingAddress: { ...order.shippingAddress, region: 'Región Metropolitana' },
      }).success,
    ).toBe(true);
  });
});
