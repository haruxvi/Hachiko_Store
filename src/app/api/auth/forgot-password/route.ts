import { NextResponse, type NextRequest } from 'next/server';
import { requestPasswordReset } from '@/src/lib/services/account-token.service';
import { ForgotPasswordSchema } from '@/src/lib/validation/schemas';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';

// Límite estricto: este endpoint dispara correos
const FORGOT_LIMIT = 5; // por IP cada 15 minutos
const FORGOT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(
      `forgot:${clientIpFrom(request.headers)}`,
      FORGOT_LIMIT,
      FORGOT_WINDOW_MS
    );
    if (!limited.allowed) {
      return NextResponse.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'Demasiados intentos, espera un momento' } },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const parsed = ForgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION', message: 'Email inválido' } },
        { status: 400 }
      );
    }

    const ip = clientIpFrom(request.headers);
    await requestPasswordReset(parsed.data.email, ip);

    // Respuesta idéntica exista o no la cuenta: no se revela qué emails
    // están registrados
    return NextResponse.json({
      ok: true,
      message: 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.',
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Error interno' } },
      { status: 500 }
    );
  }
}
