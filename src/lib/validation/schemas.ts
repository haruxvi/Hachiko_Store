import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────

// Detecta 3+ dígitos en secuencia ascendente/descendente (123, 987) o
// repetidos (111). Solo mira los dígitos tal como aparecen en el texto.
function hasConsecutiveDigits(value: string): boolean {
  for (let i = 0; i + 2 < value.length; i++) {
    const a = value.charCodeAt(i);
    const b = value.charCodeAt(i + 1);
    const c = value.charCodeAt(i + 2);
    const allDigits = a >= 48 && a <= 57 && b >= 48 && b <= 57 && c >= 48 && c <= 57;
    if (!allDigits) continue;
    const step = b - a;
    if (step === c - b && (step === 0 || step === 1 || step === -1)) return true;
  }
  return false;
}

// Política de contraseñas única para registro y restablecimiento
export const PasswordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128, 'Máximo 128 caracteres')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
  .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
  .regex(/[0-9]/, 'Debe incluir al menos un número')
  .refine((v) => !hasConsecutiveDigits(v), {
    message: 'Evita 3 o más números consecutivos o repetidos (ej. 123, 321 o 111)',
  });

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: PasswordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  consentEssential: z.literal(true, {
    error: 'Debes aceptar el tratamiento esencial de datos',
  }),
  consentMarketing: z.boolean().default(false),
  consentVersion: z.string().default('v1.0-2026'),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z
    .string()
    .regex(/^\d{6}$/, 'El código debe tener 6 dígitos')
    .optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

// "Continuar como invitado": solo email + consentimiento esencial. La cuenta
// se crea con contraseña aleatoria; se reclama después vía recuperación.
export const GuestCheckoutSchema = z.object({
  email: z.string().email(),
  consentEssential: z.literal(true, {
    error: 'Debes aceptar el tratamiento esencial de datos',
  }),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: PasswordSchema,
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(32).max(128),
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
  costCLP: z.number().int().positive().optional(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  weightGrams: z.number().int().positive(),
  images: z.array(z.string()).max(10),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  categoryId: z.string().cuid(),
});

// ─── Orders ──────────────────────────────────────────────

export const ShippingMethodSchema = z.enum(['PICKUP', 'STARKEN', 'CORREOS_CHILE']);

// Datos de entrega. Calle/número/comuna/región solo son obligatorios cuando
// hay despacho a domicilio (lo exige el superRefine de CheckoutSchema);
// para retiro en tienda bastan nombre y teléfono de quien retira.
export const ShippingAddressSchema = z.object({
  fullName: z.string().min(1, 'Requerido').max(200),
  street: z.string().max(200).optional(),
  number: z.string().max(20).optional(),
  apartment: z.string().max(50).optional(),
  commune: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  phone: z.string().regex(/^\+?56\s?9\s?\d{4}\s?\d{4}$/, 'Teléfono chileno inválido'),
  notes: z.string().max(500).optional(),
});

export const CartItemsSchema = z
  .array(
    z.object({
      productId: z.string().cuid(),
      quantity: z.number().int().min(1).max(99),
    })
  )
  .min(1, 'El carrito está vacío')
  .max(50)
  .refine(
    (items) => new Set(items.map((i) => i.productId)).size === items.length,
    'Productos duplicados en el carrito'
  );

const DELIVERY_REQUIRED_FIELDS = ['street', 'number', 'commune', 'region'] as const;

export const CheckoutSchema = z
  .object({
    shippingMethod: ShippingMethodSchema,
    shippingAddress: ShippingAddressSchema,
    paymentProvider: z.enum(['WEBPAY', 'MERCADOPAGO']),
    items: CartItemsSchema,
  })
  .superRefine((data, ctx) => {
    if (data.shippingMethod === 'PICKUP') return;
    for (const field of DELIVERY_REQUIRED_FIELDS) {
      if (!data.shippingAddress[field]?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['shippingAddress', field],
          message: 'Requerido para despacho a domicilio',
        });
      }
    }
  });

export const TrackingSchema = z.object({
  orderId: z.string().cuid(),
  // Opcional: el retiro en tienda no tiene número de seguimiento
  trackingNumber: z.string().max(100).optional(),
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
