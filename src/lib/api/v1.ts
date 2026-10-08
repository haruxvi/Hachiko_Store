import { NextResponse, type NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { verifyAccessToken, type JWTPayload } from '@/src/lib/auth/jwt';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';

// API v1 para la app nativa (mobile/). Diferencias con la web:
//   - Autenticación por `Authorization: Bearer <access>` en vez de cookies: una
//     app nativa no tiene el almacén de cookies del navegador. El refresh token
//     se guarda en el llavero cifrado del teléfono (expo-secure-store).
//   - Sin cookies no hay CSRF: otra página no puede "adjuntar" el token.
//   - Respuestas siempre { ok, data } o { ok:false, error:{ code, message } },
//     sin mensajes internos (stack, Prisma) hacia afuera.
//   - CORS solo en desarrollo, para la vista previa web de Expo (localhost:8081).
//     La app instalada no hace peticiones "cross-origin": no necesita CORS.

export type ApiSession = JWTPayload;

const DEV_ORIGINS = new Set(['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:19006']);

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin');
  if (process.env.NODE_ENV === 'production' || !origin || !DEV_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const ok = <T>(data: T) => ({ ok: true as const, data });

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, ctx: Ctx<P>) => Promise<unknown>;

/**
 * Envuelve un handler: CORS de desarrollo, errores uniformes y `Cache-Control`
 * privado (las respuestas pueden traer datos de la cuenta).
 */
export function api<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    const cors = corsHeaders(req);
    try {
      const data = await handler(req, ctx);
      return NextResponse.json(data, { headers: { ...cors, 'Cache-Control': 'private, no-store' } });
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json(
          { ok: false, error: { code: e.code, message: e.message } },
          { status: e.status, headers: cors },
        );
      }
      console.error('[api/v1]', req.method, req.nextUrl.pathname, e);
      return NextResponse.json(
        { ok: false, error: { code: 'INTERNAL', message: 'Algo falló de nuestro lado. Inténtalo de nuevo.' } },
        { status: 500, headers: cors },
      );
    }
  };
}

/** Respuesta al preflight de CORS (solo tiene efecto en desarrollo). */
export function options(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/** Sesión desde el token Bearer, o null si no hay/expiró. */
export async function bearerSession(req: NextRequest): Promise<ApiSession | null> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+([A-Za-z0-9._~-]{20,4096})$/.exec(header);
  if (!match) return null;
  try {
    return await verifyAccessToken(match[1]!);
  } catch {
    return null;
  }
}

/** Exige sesión (y rol, si se indica). 401 = renovar token; 403 = no corresponde. */
export async function requireSession(req: NextRequest, role?: Role): Promise<ApiSession> {
  const session = await bearerSession(req);
  if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  if (role && session.role !== role) throw new ApiError(403, 'FORBIDDEN', 'Tu cuenta no tiene acceso a esta sección.');
  return session;
}

/** Límite por IP (y por usuario si hay sesión). */
export async function limit(req: NextRequest, bucket: string, max: number, windowMs: number, who?: string) {
  const key = `v1:${bucket}:${who ?? clientIpFrom(req.headers)}`;
  const r = await rateLimit(key, max, windowMs);
  if (!r.allowed) throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas solicitudes seguidas. Espera un momento.');
}

/** Cuerpo JSON acotado (no se aceptan cuerpos gigantes). */
export async function jsonBody(req: NextRequest, maxBytes = 16 * 1024): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new ApiError(413, 'TOO_LARGE', 'La solicitud es demasiado grande.');
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, 'TOO_LARGE', 'La solicitud es demasiado grande.');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, 'BAD_JSON', 'La solicitud no es válida.');
  }
}

/** Parseo con zod que lanza un 400 con el primer mensaje legible. */
export function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ApiError(400, 'VALIDATION', r.error.issues[0]?.message ?? 'Datos inválidos.');
  return r.data;
}
