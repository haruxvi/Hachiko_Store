import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe tener al menos un número'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  consentEssential: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar el tratamiento esencial de datos' }),
  }),
  consentMarketing: z.boolean().default(false),
  consentVersion: z.string().default('v1.0-2026'),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Catalog ─────────────────────────────────────────────

export const CategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  active: z.boolean().default(true),
  order: z.number().int().default(0),
});

export const ProductSchema = z.object({
  sku: z.string().min(1).max(50),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  nameKorean: z.string().max(200).optional(),
  description: z.string().min(1).max(5000),
  priceCLP: z.number().int().positive(),
  stock: z.number().int().min(0),
  weightGrams: z.number().int().positive(),
  images: z.array(z.string().url()).max(10),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  categoryId: z.string().cuid(),
});

// ─── Orders ──────────────────────────────────────────────

export const ShippingAddressSchema = z.object({
  fullName: z.string().min(1).max(200),
  street: z.string().min(1).max(200),
  number: z.string().min(1).max(20),
  apartment: z.string().max(50).optional(),
  commune: z.string().min(1).max(100),
  region: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?56\s?9\s?\d{4}\s?\d{4}$/, 'Teléfono chileno inválido'),
  email: z.string().email(),
  notes: z.string().max(500).optional(),
});

export const CheckoutSchema = z.object({
  shippingAddress: ShippingAddressSchema,
  paymentProvider: z.enum(['WEBPAY', 'MERCADOPAGO']),
});

export const TrackingSchema = z.object({
  orderId: z.string().cuid(),
  trackingNumber: z.string().min(1).max(100),
});

// ─── Account ─────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+?56\s?9\s?\d{4}\s?\d{4}$/)
    .optional(),
  consentMarketing: z.boolean().optional(),
});

export const DeleteAccountSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const PiiAccessReasonSchema = z.object({
  reason: z.string().min(10, 'Describe el motivo de acceso (mínimo 10 caracteres)'),
  orderId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
});

// ─── Payments ────────────────────────────────────────────

export const WebpayCreateSchema = z.object({
  orderId: z.string().cuid(),
});

export const MpPreferenceSchema = z.object({
  orderId: z.string().cuid(),
});
