import type { ShippingMethod } from '@prisma/client';

// Única fuente de verdad de los métodos de entrega. Todo lo que se muestra al
// cliente (checkout, mis pedidos, correos) y al vendedor (trastienda) sale de
// aquí: el método que el cliente eligió es el ÚNICO que aparece después.
//
// Tarifa actual: plana para despacho a domicilio (gratis sobre el umbral) y
// $0 para retiro en tienda. Cuando se definan tarifas por región/courier,
// este módulo es el único lugar que cambia.

export const SHIPPING_CLP = 3990;
export const FREE_SHIPPING_THRESHOLD = 50000;

interface ShippingMethodInfo {
  label: string;
  /** Descripción corta que ve el cliente al elegir */
  description: string;
  /** true si requiere dirección de despacho */
  requiresAddress: boolean;
  /** URL de seguimiento del courier, si aplica */
  trackingUrl: ((trackingNumber: string) => string) | null;
}

export const SHIPPING_METHODS: Record<ShippingMethod, ShippingMethodInfo> = {
  PICKUP: {
    label: 'Retiro en tienda',
    description: 'Gratis — Recoleta, Santiago. Te avisamos por correo cuando esté listo.',
    requiresAddress: false,
    trackingUrl: null,
  },
  STARKEN: {
    label: 'Starken',
    description: 'Despacho a domicilio, 2–5 días hábiles.',
    requiresAddress: true,
    trackingUrl: (n) => `https://www.starken.cl/seguimiento?codigo=${encodeURIComponent(n)}`,
  },
  CORREOS_CHILE: {
    label: 'Correos de Chile',
    description: 'Despacho a domicilio, 3–6 días hábiles.',
    requiresAddress: true,
    trackingUrl: (n) =>
      `https://www.correos.cl/web/guest/seguimiento-en-linea?codigo=${encodeURIComponent(n)}`,
  },
};

export function calculateShipping(subtotal: number, method: ShippingMethod = 'STARKEN'): number {
  if (!SHIPPING_METHODS[method].requiresAddress) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CLP;
}

export function shippingLabel(method: ShippingMethod): string {
  return SHIPPING_METHODS[method].label;
}

export function trackingUrlFor(method: ShippingMethod, trackingNumber: string | null): string | null {
  const builder = SHIPPING_METHODS[method].trackingUrl;
  if (!builder || !trackingNumber) return null;
  return builder(trackingNumber);
}
