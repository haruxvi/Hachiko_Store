import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { rotateRefreshToken } from '@/src/lib/auth/rotate';
import { api, ApiError, jsonBody, limit, ok, options, parse } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Rotación: cada refresh entrega un par nuevo. Si el usuario cerró sesión en
// otro dispositivo, cambió de rol o su cuenta se bloqueó/eliminó, se rechaza.
const Body = z.object({ refreshToken: z.string().min(20).max(4096) });

export const POST = api(async (req: NextRequest) => {
  await limit(req, 'refresh', 30, 60_000);
  const { refreshToken } = parse(Body, await jsonBody(req));
  const r = await rotateRefreshToken(refreshToken);
  if (!r.ok) throw new ApiError(401, r.code, 'Tu sesión expiró. Vuelve a iniciar sesión.');
  return ok({ accessToken: r.accessToken, refreshToken: r.refreshToken, accessExpiresIn: 15 * 60 });
});
