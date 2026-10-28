import type { NextRequest } from 'next/server';
import { getUserProfile } from '@/src/lib/services/auth.service';
import { getAccountSummary } from '@/src/lib/services/customer.service';
import { api, ApiError, limit, ok, options, requireSession } from '@/src/lib/api/v1';

export { options as OPTIONS };

// Perfil de la cuenta para la pestaña "Cuenta" de la app.
export const GET = api(async (req: NextRequest) => {
  const session = await requireSession(req);
  await limit(req, 'me', 60, 60_000, session.sub);
  const [profile, summary] = await Promise.all([getUserProfile(session.sub), getAccountSummary(session.sub)]);
  if (!profile) throw new ApiError(401, 'UNAUTHENTICATED', 'Tu sesión expiró. Vuelve a iniciar sesión.');
  return ok({
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    role: profile.role,
    emailVerified: profile.emailVerified !== null,
    twoFactor: profile.totpEnabledAt !== null,
    consentMarketing: profile.consentMarketing,
    memberSince: profile.createdAt,
    orderCount: summary.orderCount,
    lastOrder: summary.lastOrder,
  });
});
