'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/src/lib/auth/session';
import { rateLimit, clientIpFrom } from '@/src/lib/rate-limit';
import { PromoInputSchema, SubscribeSchema } from '@/src/lib/newsletter/validation';
import {
  subscribe,
  confirmSubscription,
  unsubscribe,
  sendPromoTest,
  sendPromoCampaign,
  type SendError,
} from '@/src/lib/services/newsletter.service';

// ─── Público: suscripción, confirmación y baja ───────────

export interface SubscribeState {
  status: 'idle' | 'ok' | 'error';
  message: string;
}

export async function subscribeNewsletterAction(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const ok: SubscribeState = {
    status: 'ok',
    message: 'Listo. Te enviamos un correo: confirma desde ahí para empezar a recibir promociones.',
  };

  // Campo trampa invisible para personas: si viene lleno, es un bot. Se responde
  // igual que un éxito para no darle pistas.
  if (String(formData.get('website') ?? '').length > 0) return ok;

  const ip = clientIpFrom(await headers());
  const limited = await rateLimit(`newsletter-subscribe:${ip}`, 5, 10 * 60 * 1000);
  if (!limited.allowed) {
    return { status: 'error', message: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' };
  }

  const parsed = SubscribeSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Ingresa un correo válido.' };
  }

  try {
    await subscribe(parsed.data.email, ip);
  } catch {
    return { status: 'error', message: 'No pudimos registrar tu suscripción. Inténtalo más tarde.' };
  }
  return ok;
}

// Confirmar y darse de baja son botones (POST), no enlaces que actúan al abrirse:
// los escáneres de seguridad de los clientes de correo abren los links solos y
// confirmarían o darían de baja a la persona sin que lo pidiera.
export async function confirmSubscriptionAction(formData: FormData): Promise<void> {
  const ip = clientIpFrom(await headers());
  const limited = await rateLimit(`newsletter-confirm:${ip}`, 20, 10 * 60 * 1000);
  const result = limited.allowed ? await confirmSubscription(String(formData.get('token') ?? '')) : 'invalid';
  redirect(`/newsletter/confirmar?estado=${result === 'invalid' ? 'invalido' : 'ok'}`);
}

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const ip = clientIpFrom(await headers());
  const limited = await rateLimit(`newsletter-unsub:${ip}`, 20, 10 * 60 * 1000);
  const done = limited.allowed ? await unsubscribe(String(formData.get('token') ?? '')) : false;
  redirect(`/newsletter/baja?estado=${done ? 'ok' : 'invalido'}`);
}

// ─── Panel: promociones (solo vendedor) ──────────────────

export type PromoActionResult = { ok: true; message: string } | { ok: false; message: string };

const ERRORS: Record<SendError, string> = {
  NOT_CONFIGURED: 'El envío de correos no está configurado (falta RESEND_API_KEY).',
  NO_AUDIENCE: 'Todavía no hay suscriptores que puedan recibir promociones.',
  IN_PROGRESS: 'Ya hay un envío en curso. Espera a que termine antes de enviar otro.',
  FAILED: 'No se pudo enviar. Revisa la configuración de correo e inténtalo de nuevo.',
};

const people = (n: number) => `${n} ${n === 1 ? 'persona' : 'personas'}`;

async function requireSeller() {
  const session = await getSession();
  return session && session.role === 'SELLER' ? session : null;
}

export async function sendPromoTestAction(input: unknown): Promise<PromoActionResult> {
  const session = await requireSeller();
  if (!session) return { ok: false, message: 'Sin permisos.' };

  const limited = await rateLimit(`promo-test:${session.sub}`, 10, 60 * 60 * 1000);
  if (!limited.allowed) return { ok: false, message: 'Llegaste al máximo de pruebas por hora.' };

  const parsed = PromoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };

  const result = await sendPromoTest(parsed.data, { id: session.sub, email: session.email });
  return result.ok
    ? { ok: true, message: `Te enviamos la prueba a ${session.email}.` }
    : { ok: false, message: ERRORS[result.error] };
}

export async function sendPromoCampaignAction(input: unknown): Promise<PromoActionResult> {
  const session = await requireSeller();
  if (!session) return { ok: false, message: 'Sin permisos.' };

  // Tope de campañas: protege a los clientes de un envío repetido por error y a
  // la reputación del remitente.
  const limited = await rateLimit(`promo-send:${session.sub}`, 5, 60 * 60 * 1000);
  if (!limited.allowed) return { ok: false, message: 'Llegaste al máximo de envíos por hora.' };

  const parsed = PromoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };

  const ip = clientIpFrom(await headers());
  const result = await sendPromoCampaign(parsed.data, session.sub, ip);
  revalidatePath('/trastienda/promociones');

  if (!result.ok) return { ok: false, message: ERRORS[result.error] };
  return {
    ok: true,
    message:
      result.failed > 0
        ? `Enviada a ${people(result.sent)}; ${result.failed} ${result.failed === 1 ? 'correo no se pudo' : 'correos no se pudieron'} entregar.`
        : `Promoción enviada a ${people(result.sent)}.`,
  };
}
