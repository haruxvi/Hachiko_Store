import { Prisma } from '@prisma/client';
import { db } from '@/src/lib/db';
import { sendEmail, sendEmailBatch, type EmailInput } from '@/src/lib/email';
import { signNewsletterToken, verifyNewsletterToken, type NewsletterSubject } from '@/src/lib/newsletter/tokens';
import { promoEmail, newsletterConfirmEmail, absoluteUrl, type PromoProduct } from '@/src/lib/newsletter/templates';
import { NEWSLETTER_CONSENT_VERSION, isDeliverableEmail, type PromoInput } from '@/src/lib/newsletter/validation';
import { writeAudit } from './audit.service';

// Promociones por correo (Ley 21.719: solo con consentimiento, revocable en un clic).
//
// Hay dos formas de dar el consentimiento de marketing:
//  1. Cuenta registrada: casilla opcional del registro o del perfil (User.consentMarketing).
//  2. Formulario del footer, sin cuenta: NewsletterSubscriber, activo solo tras
//     confirmar desde el correo (doble opt-in).
// La baja es por correo electrónico y apaga ambas a la vez, para que nadie siga
// recibiendo promociones por "la otra vía".

const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
// No reenviar el correo de confirmación a la misma casilla antes de esto: evita
// usar el formulario para inundar el correo de otra persona.
const RESEND_CONFIRMATION_AFTER_MS = 10 * 60 * 1000;
const PENDING_RETENTION_DAYS = 30;
// Un envío en curso bloquea otro durante este tiempo (doble clic, reintentos).
const SENDING_LOCK_MS = 10 * 60 * 1000;

const appUrl = () => process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

// ─── Suscripción desde el footer ─────────────────────────

/**
 * Registra el consentimiento y envía el correo de confirmación. La respuesta
 * hacia el visitante es siempre la misma, exista o no la suscripción: así el
 * formulario no sirve para averiguar qué correos están suscritos.
 */
export async function subscribe(email: string, ip?: string): Promise<void> {
  if (!isDeliverableEmail(email)) return;

  const now = new Date();
  const existing = await db.newsletterSubscriber.findUnique({ where: { email } });
  if (existing?.status === 'CONFIRMED') return;
  if (
    existing?.status === 'PENDING' &&
    existing.confirmationSentAt &&
    now.getTime() - existing.confirmationSentAt.getTime() < RESEND_CONFIRMATION_AFTER_MS
  ) {
    return;
  }

  const consent = {
    status: 'PENDING' as const,
    consentVersion: NEWSLETTER_CONSENT_VERSION,
    consentAt: now,
    consentIp: ip ?? null,
    confirmationSentAt: now,
  };

  let subscriber;
  try {
    subscriber = await db.newsletterSubscriber.upsert({
      where: { email },
      create: { email, ...consent },
      // Quien se dio de baja puede volver a suscribirse: queda un consentimiento nuevo.
      update: { ...consent, confirmedAt: null, unsubscribedAt: null },
    });
  } catch (e) {
    // Dos envíos simultáneos del mismo correo: el otro ya lo registró.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
    throw e;
  }

  const token = signNewsletterToken('confirm', 'sub', subscriber.id, CONFIRM_TTL_MS);
  await sendEmail({ to: email, ...newsletterConfirmEmail(`${appUrl()}/newsletter/confirmar?token=${token}`) });
}

export type ConfirmResult = 'confirmed' | 'already' | 'invalid';

export async function confirmSubscription(token: string): Promise<ConfirmResult> {
  const parsed = verifyNewsletterToken(token, 'confirm');
  if (!parsed || parsed.subject !== 'sub') return 'invalid';

  const subscriber = await db.newsletterSubscriber.findUnique({ where: { id: parsed.id } });
  if (!subscriber) return 'invalid';
  if (subscriber.status === 'CONFIRMED') return 'already';
  // Dado de baja: un enlace de confirmación antiguo no lo vuelve a suscribir.
  if (subscriber.status !== 'PENDING') return 'invalid';

  const updated = await db.newsletterSubscriber.updateMany({
    where: { id: subscriber.id, status: 'PENDING' },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
  });
  return updated.count > 0 ? 'confirmed' : 'already';
}

// ─── Baja ─────────────────────────────────────────────────

/** Apaga el marketing de un correo en todas sus vías (suscripción y cuenta). */
export async function unsubscribeEmailEverywhere(email: string): Promise<void> {
  const now = new Date();
  const sameEmail = { equals: email, mode: 'insensitive' as const };
  await db.$transaction([
    db.newsletterSubscriber.updateMany({
      where: { email: sameEmail, status: { not: 'UNSUBSCRIBED' } },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: now },
    }),
    db.user.updateMany({
      where: { email: sameEmail, consentMarketing: true },
      data: { consentMarketing: false, consentUpdatedAt: now },
    }),
  ]);
}

/** Baja desde el enlace del correo. Idempotente: repetirla no falla. */
export async function unsubscribe(token: string): Promise<boolean> {
  const parsed = verifyNewsletterToken(token, 'unsub');
  if (!parsed) return false;

  const email =
    parsed.subject === 'sub'
      ? (await db.newsletterSubscriber.findUnique({ where: { id: parsed.id }, select: { email: true } }))?.email
      : (await db.user.findUnique({ where: { id: parsed.id }, select: { email: true } }))?.email;
  if (email) await unsubscribeEmailEverywhere(email);
  return true;
}

// ─── Audiencia ────────────────────────────────────────────

interface Recipient {
  email: string;
  subject: NewsletterSubject;
  id: string;
}

/**
 * Quiénes reciben promociones: cuentas con consentimiento de marketing y correo
 * VERIFICADO (sin verificar no sabemos si la casilla es de quien se registró), más
 * suscriptores confirmados del footer. Sin duplicados y sin dominios reservados.
 */
export async function getPromoAudience(): Promise<Recipient[]> {
  const [users, subscribers] = await Promise.all([
    db.user.findMany({
      where: { consentMarketing: true, deletedAt: null, emailVerified: { not: null } },
      select: { id: true, email: true },
    }),
    db.newsletterSubscriber.findMany({ where: { status: 'CONFIRMED' }, select: { id: true, email: true } }),
  ]);

  const byEmail = new Map<string, Recipient>();
  for (const s of subscribers) byEmail.set(s.email.toLowerCase(), { email: s.email, subject: 'sub', id: s.id });
  for (const u of users) byEmail.set(u.email.toLowerCase(), { email: u.email, subject: 'user', id: u.id });
  return [...byEmail.values()].filter((r) => isDeliverableEmail(r.email));
}

// ─── Envío de promociones ────────────────────────────────

async function loadPromoProducts(ids: string[]): Promise<PromoProduct[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    where: { id: { in: ids }, active: true, archivedAt: null },
    select: { id: true, name: true, priceCLP: true, slug: true, images: true },
  });
  // Respeta el orden en que el vendedor eligió los productos.
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      name: p.name,
      priceCLP: p.priceCLP,
      url: absoluteUrl(appUrl(), `/producto/${p.slug}`),
      image: p.images[0] ?? null,
    }));
}

function buildPromoMessage(input: PromoInput, products: PromoProduct[], to: Recipient, subjectPrefix = ''): EmailInput {
  const token = signNewsletterToken('unsub', to.subject, to.id);
  return {
    to: to.email,
    subject: `${subjectPrefix}${input.subject}`,
    html: promoEmail({
      title: input.title,
      body: input.body,
      cta:
        input.ctaLabel && input.ctaPath
          ? { label: input.ctaLabel, url: absoluteUrl(appUrl(), input.ctaPath) }
          : null,
      products,
      unsubscribeUrl: `${appUrl()}/newsletter/baja?token=${token}`,
    }),
    // Baja en un clic (RFC 8058): Gmail y Yahoo la exigen a quien envía correos
    // masivos, y muestran el botón "Anular suscripción" junto al remitente.
    headers: {
      'List-Unsubscribe': `<${appUrl()}/api/newsletter/unsubscribe?token=${token}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export type SendError = 'NO_AUDIENCE' | 'IN_PROGRESS' | 'NOT_CONFIGURED' | 'FAILED';

/** Correo de prueba solo al vendedor, con el contenido exacto de la promoción. */
export async function sendPromoTest(
  input: PromoInput,
  seller: { id: string; email: string },
): Promise<{ ok: true } | { ok: false; error: SendError }> {
  if (!process.env['RESEND_API_KEY']) return { ok: false, error: 'NOT_CONFIGURED' };
  const products = await loadPromoProducts(input.productIds);
  const sent = await sendEmail(
    buildPromoMessage(input, products, { email: seller.email, subject: 'user', id: seller.id }, '[Prueba] '),
  );
  return sent ? { ok: true } : { ok: false, error: 'FAILED' };
}

export async function sendPromoCampaign(
  input: PromoInput,
  sellerId: string,
  ip?: string,
): Promise<{ ok: true; sent: number; failed: number } | { ok: false; error: SendError }> {
  if (!process.env['RESEND_API_KEY']) return { ok: false, error: 'NOT_CONFIGURED' };

  const inProgress = await db.promoCampaign.findFirst({
    where: { status: 'SENDING', createdAt: { gt: new Date(Date.now() - SENDING_LOCK_MS) } },
    select: { id: true },
  });
  if (inProgress) return { ok: false, error: 'IN_PROGRESS' };

  const audience = await getPromoAudience();
  if (audience.length === 0) return { ok: false, error: 'NO_AUDIENCE' };

  const products = await loadPromoProducts(input.productIds);
  const campaign = await db.promoCampaign.create({
    data: {
      subject: input.subject,
      title: input.title,
      body: input.body,
      ctaLabel: input.ctaLabel || null,
      ctaPath: input.ctaPath || null,
      productIds: input.productIds,
      status: 'SENDING',
      recipientCount: audience.length,
      createdById: sellerId,
    },
  });

  const result = await sendEmailBatch(audience.map((r) => buildPromoMessage(input, products, r)));
  const status = result.sent === 0 ? 'FAILED' : result.failed > 0 ? 'PARTIAL' : 'SENT';

  await db.promoCampaign.update({
    where: { id: campaign.id },
    data: { status, failedCount: result.failed, sentAt: new Date() },
  });
  await writeAudit({
    actorId: sellerId,
    actorRole: 'SELLER',
    action: 'PROMO_CAMPAIGN_SENT',
    targetType: 'PromoCampaign',
    targetId: campaign.id,
    metadata: { recipients: audience.length, sent: result.sent, failed: result.failed },
    ip,
  });

  return result.sent > 0 ? { ok: true, sent: result.sent, failed: result.failed } : { ok: false, error: 'FAILED' };
}

/** Datos del editor de promociones: audiencia, productos activos y categorías. */
export async function getPromoComposerData() {
  const [audience, products, categories] = await Promise.all([
    getPromoAudience(),
    db.product.findMany({
      where: { active: true, archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, priceCLP: true, slug: true, images: true },
    }),
    db.category.findMany({
      where: { active: true, archivedAt: null },
      orderBy: { order: 'asc' },
      select: { name: true, slug: true },
    }),
  ]);
  return {
    audienceCount: audience.length,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      priceCLP: p.priceCLP,
      slug: p.slug,
      image: p.images[0] ?? null,
    })),
    categories,
  };
}

export async function getRecentCampaigns(limit = 20) {
  return db.promoCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      subject: true,
      status: true,
      recipientCount: true,
      failedCount: true,
      createdAt: true,
      sentAt: true,
    },
  });
}

// ─── Retención ────────────────────────────────────────────

/** Minimización (Ley 21.719): suscripciones nunca confirmadas no se guardan para siempre. */
export async function purgeStalePendingSubscribers(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - PENDING_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await db.newsletterSubscriber.deleteMany({
    where: { status: 'PENDING', consentAt: { lt: cutoff } },
  });
  return { purged: result.count };
}
