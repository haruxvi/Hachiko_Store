import { NextResponse, type NextRequest } from 'next/server';
import { registerUser } from '@/src/lib/services/auth.service';
import { RegisterSchema } from '@/src/lib/validation/schemas';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';
import { readJsonBody } from '@/src/lib/http-body';

const REGISTER_LIMIT = 5; // registros por IP por minuto
const REGISTER_WINDOW_MS = 60 * 1000;

// Respuesta única para no revelar si el correo ya existía (anti-enumeración).
// La cuenta NO inicia sesión automáticamente: la persona entra después por el
// login. Un correo nuevo recibe el enlace de verificación; uno existente, un
// aviso de que ya tiene cuenta.
const GENERIC_MESSAGE =
  'Si el correo estaba disponible, creamos tu cuenta y te enviamos un enlace de verificación. Ya puedes iniciar sesión.';

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

    const read = await readJsonBody(request);
    if (!read.ok) return read.response;
    const parsed = RegisterSchema.safeParse(read.data);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Datos inválidos' } },
        { status: 400 }
      );
    }

    const ip = clientIpFrom(request.headers);
    // No se usa el resultado (created) en la respuesta: así ambos casos son
    // indistinguibles para quien intente enumerar correos.
    await registerUser(parsed.data, ip);

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Error interno' } },
      { status: 500 }
    );
  }
}
