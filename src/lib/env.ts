import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  DATA_ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex = 64 chars
  TBK_ENV: z.enum(['integration', 'production']).default('integration'),
  TBK_COMMERCE_CODE: z.string().min(1),
  TBK_API_KEY: z.string().min(1),
  MP_ACCESS_TOKEN: z.string().min(1),
  MP_PUBLIC_KEY: z.string().min(1),
  // Opcionales: el webhook usa `?? ''` y el email se omite si falta la key.
  // Así la app arranca aunque aún no estén configurados.
  MP_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Hachiko <hola@hachiko.cl>'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET debe tener al menos 16 caracteres'),
  LOW_STOCK_DEFAULT: z.coerce.number().int().min(0).default(5),
  RESERVATION_TTL_MINUTES: z.coerce.number().int().min(1).default(15),
  // Rate limiter compartido (opcional). Si faltan, se usa el límite en memoria
  // por instancia. Recomendado en producción serverless para un límite real.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
  throw new Error(`Invalid environment variables: ${missing}`);
}

export const env = parsed.data;
