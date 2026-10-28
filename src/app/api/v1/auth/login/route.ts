import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { loginUser } from '@/src/lib/services/auth.service';
import { LoginSchema } from '@/src/lib/validation/schemas';
import { verifyAccessToken } from '@/src/lib/auth/jwt';
import { clientIpFrom } from '@/src/lib/rate-limit';
import { db } from '@/src/lib/db';
import { api, ApiError, jsonBody, limit, ok, options, parse } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Inicio de sesión de la app: mismas reglas que la web (bloqueo por intentos,
// TOTP, auditoría en loginUser), pero los tokens vuelven en el cuerpo para que
// la app los guarde en el llavero cifrado del teléfono.
const Body = LoginSchema.extend({ email: z.string().trim().toLowerCase().email('Escribe un correo válido.') });

export const POST = api(async (req: NextRequest) => {
  await limit(req, 'login', 10, 60_000);
  const input = parse(Body, await jsonBody(req));

  const result = await loginUser(input, clientIpFrom(req.headers), req.headers.get('user-agent') ?? 'hachiko-app');
  if (!result.ok) {
    // TOTP_REQUIRED no es un error: la app muestra el campo del código.
    const status = result.error.code === 'TOTP_REQUIRED' ? 200 : 401;
    if (status === 200) return { ok: false, error: result.error };
    throw new ApiError(status, result.error.code, result.error.message);
  }

  const session = await verifyAccessToken(result.accessToken);
  const profile = await db.user.findUnique({ where: { id: session.sub }, select: { firstName: true } });
  return ok({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessExpiresIn: 15 * 60,
    user: { role: session.role, email: session.email, firstName: profile?.firstName ?? null },
  });
});
