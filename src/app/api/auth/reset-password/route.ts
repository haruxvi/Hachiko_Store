import { NextResponse, type NextRequest } from 'next/server';
import { resetPassword } from '@/src/lib/services/account-token.service';
import { ResetPasswordSchema } from '@/src/lib/validation/schemas';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';

const RESET_LIMIT = 10; // por IP por minuto — frena fuerza bruta de tokens
const RESET_WINDOW_MS = 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(
      `reset:${clientIpFrom(request.headers)}`,
      RESET_LIMIT,
      RESET_WINDOW_MS
    );
    if (!limited.allowed) {
      return NextResponse.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'Demasiados intentos, espera un momento' } },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Datos inválidos' } },
        { status: 400 }
      );
    }

    const ip = clientIpFrom(request.headers);
    const ok = await resetPassword(parsed.data.token, parsed.data.password, ip);

    if (!ok) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'INVALID_TOKEN', message: 'El enlace expiró o ya fue usado. Solicita uno nuevo.' },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.',
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Error interno' } },
      { status: 500 }
    );
  }
}
