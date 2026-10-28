import { z } from 'zod';

// Reglas compartidas de promociones por correo. Sin dependencias de servidor:
// las usa también la vista previa del panel (cliente) y los tests.

export const NEWSLETTER_CONSENT_VERSION = 'newsletter-v1.0-2026';
export const MAX_PROMO_PRODUCTS = 4;

// Dominios reservados que nunca reciben correo real (RFC 2606 / 6761): los
// usan los datos sintéticos (@seed.hachiko.test) y las cuentas de prueba del
// Docker local (@hachiko.local). Enviarles generaría rebotes y dañaría la
// reputación del remitente.
const RESERVED_TLDS = ['.test', '.example', '.invalid', '.localhost', '.local'];
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

export function isDeliverableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  if (!domain) return false;
  return !RESERVED_TLDS.some((tld) => domain.endsWith(tld)) && !RESERVED_DOMAINS.includes(domain);
}

export const SubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo válido.').max(254),
});

// Una línea sin saltos: el asunto viaja como cabecera del correo, y un salto de
// línea permitiría inyectar cabeceras (p. ej. destinatarios ocultos).
const singleLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => !/[\r\n]/.test(s), 'No puede contener saltos de línea.');

// Destino del botón: solo rutas internas de la tienda ("/catalogo?categoria=x").
// Se rechaza "//dominio" (URL relativa al protocolo, que apunta afuera) y
// cualquier esquema: así un correo de Hachiko nunca enlaza a un sitio externo.
const internalPath = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/, 'El destino debe ser una página de la tienda (empieza con /).');

export const PromoInputSchema = z.object({
  subject: singleLine(120).pipe(z.string().min(3, 'El asunto es muy corto.')),
  title: singleLine(120).pipe(z.string().min(3, 'El título es muy corto.')),
  body: z.string().trim().min(10, 'El mensaje es muy corto.').max(2000, 'El mensaje supera 2.000 caracteres.'),
  ctaLabel: singleLine(40).optional(),
  ctaPath: internalPath.optional(),
  productIds: z.array(z.string().min(1).max(64)).max(MAX_PROMO_PRODUCTS).default([]),
});

export type PromoInput = z.infer<typeof PromoInputSchema>;
