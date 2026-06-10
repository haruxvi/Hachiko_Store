import { NextResponse, type NextRequest } from 'next/server';
import { loginUser } from '@/src/lib/services/auth.service';
import { LoginSchema } from '@/src/lib/validation/schemas';
import { accessCookieOptions, refreshCookieOptions } from '@/src/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Datos inválidos' } },
        { status: 400 }
      );
    }

    // x-forwarded-for puede traer una cadena de proxies; la IP del cliente es la primera
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    const userAgent = request.headers.get('user-agent') ?? undefined;

    const result = await loginUser(parsed.data, ip, userAgent);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
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
