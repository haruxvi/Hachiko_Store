// Rate limiter con dos modos:
//   1. Store compartido (Upstash Redis vía REST) si están definidas
//      UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN. En serverless este es
//      el único límite REAL: todas las instancias comparten el contador.
//   2. Fallback en memoria por instancia si no hay Redis configurado. Es
//      best-effort (cada instancia cuenta aparte) pero no requiere infra.
// Si Redis está configurado pero falla, se cae al modo memoria en vez de
// bloquear el login (fail-safe hacia disponibilidad, con backstop local).

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function inMemoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // Evita crecimiento sin límite si llegan muchas IPs distintas
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

const UPSTASH_URL = process.env['UPSTASH_REDIS_REST_URL'];
const UPSTASH_TOKEN = process.env['UPSTASH_REDIS_REST_TOKEN'];
const useRedis = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

async function redisLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  // Pipeline atómico: incrementa, fija expiración solo la primera vez (NX) y
  // devuelve el TTL restante para el header Retry-After.
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify([
      ['INCR', `rl:${key}`],
      ['PEXPIRE', `rl:${key}`, windowMs, 'NX'],
      ['PTTL', `rl:${key}`],
    ]),
  });

  if (!res.ok) throw new Error(`rate-limit store responded ${res.status}`);

  const data = (await res.json()) as Array<{ result?: number; error?: string }>;
  const count = data[0]?.result ?? 1;
  const ttlMs = data[2]?.result ?? windowMs;

  if (count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (useRedis) {
    try {
      return await redisLimit(key, limit, windowMs);
    } catch {
      // Si el store compartido falla, no dejamos la puerta abierta ni caída:
      // aplicamos el límite local como respaldo.
    }
  }
  return inMemoryLimit(key, limit, windowMs);
}

export function clientIpFrom(headers: Headers): string {
  // x-real-ip lo fija el proxy de confianza (p. ej. Vercel) con la IP real del
  // cliente y es un valor único, así que no se puede anteponer una IP falsa.
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  // Fallback: en x-forwarded-for la ÚLTIMA entrada la agrega el proxy de
  // confianza; las de la izquierda las puede falsificar el cliente (Burp, curl…).
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return 'unknown';
}
