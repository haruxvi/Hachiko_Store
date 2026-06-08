import { NextResponse, type NextRequest } from 'next/server';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/src/lib/auth/jwt';
import { accessCookieOptions, refreshCookieOptions } from '@/src/lib/auth/session';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('hachiko_refresh')?.value;

  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: { code: 'NO_REFRESH' } }, { status: 401 });
  }

  try {
    const payload = await verifyRefreshToken(refreshToken);
    const newPayload = { sub: payload.sub, role: payload.role, email: payload.email };
    const [accessToken, newRefreshToken] = await Promise.all([
      signAccessToken(newPayload),
      signRefreshToken(newPayload),
    ]);

    const response = NextResponse.json({ ok: true });
    const accessOpts = accessCookieOptions();
    const refreshOpts = refreshCookieOptions();

    response.cookies.set(accessOpts.name, accessToken, accessOpts.options);
    response.cookies.set(refreshOpts.name, newRefreshToken, refreshOpts.options);

    return response;
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'INVALID_REFRESH' } }, { status: 401 });
  }
}
