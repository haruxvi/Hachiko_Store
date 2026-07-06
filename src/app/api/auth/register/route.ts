import { NextResponse, type NextRequest } from 'next/server';
import { registerUser } from '@/src/lib/services/auth.service';
import { RegisterSchema } from '@/src/lib/validation/schemas';
import { accessCookieOptions, refreshCookieOptions } from '@/src/lib/auth/session';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';

const REGISTER_LIMIT = 5; // registros por IP por minuto
const REGISTER_WINDOW_MS = 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(
      `register:${clientIpFrom(request.headers)}`,
      REGISTER_LIMIT,
      REGISTER_WINDOW_MS
    );
    if (!limited.allowed) {
      return NextResponse.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'Demasiados intentos, espera un momento' } },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Datos inválidos' } },
        { status: 400 }
      );
    }

    const ip = clientIpFrom(request.headers);
    const result = await registerUser(parsed.data, ip);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }

    const response = NextResponse.json({ ok: true, data: { role: result.role } });
    const accessOpts = accessCookieOptions();
    const refreshOpts = refreshCookieOptions();

    response.cookies.set(accessOpts.name, result.accessToken, accessOpts.options);
    response.cookies.set(refreshOpts.name, result.refreshToken, refreshOpts.options);

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Error interno' } },
      { status: 500 }
    );
  }
}
