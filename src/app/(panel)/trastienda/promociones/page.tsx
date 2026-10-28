import { getSession } from '@/src/lib/auth/session';
import { getPromoComposerData, getRecentCampaigns } from '@/src/lib/services/newsletter.service';
import { PageHeader, Eyebrow, Stat, num } from '@/src/components/panel/intelligence-ui';
import PromoComposer from '@/src/components/panel/PromoComposer';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; className: string }> = {
  SENT: { label: 'Enviada', className: 'chip-mint' },
  PARTIAL: { label: 'Parcial', className: 'chip-rust' },
  FAILED: { label: 'Falló', className: 'chip-hs border-transparent bg-alert/[0.12] text-alert' },
  SENDING: { label: 'Enviando', className: 'chip-sky' },
};

export default async function PromocionesPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const [data, campaigns] = await Promise.all([getPromoComposerData(), getRecentCampaigns()]);
  const emailConfigured = !!process.env['RESEND_API_KEY'];
  const testMode = (process.env['EMAIL_FROM'] ?? '').includes('@resend.dev');
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

  return (
    <div className="space-y-8">
      <PageHeader title="Promociones" subtitle="Correos para quienes aceptaron recibir novedades" />

      {!emailConfigured && (
        <p className="rounded-input border border-rust/30 bg-rust/[0.08] px-4 py-3 text-sm text-rust-ink">
          El envío de correos no está configurado (falta <code>RESEND_API_KEY</code>). Puedes armar la
          promoción y verla, pero no enviarla.
        </p>
      )}
      {emailConfigured && testMode && (
        <p className="rounded-input border border-sand bg-cream px-4 py-3 text-sm text-taupe">
          <span className="font-semibold text-soot">Modo de prueba de Resend:</span> los correos solo llegan
          al dueño de la cuenta de Resend. Para enviar a clientes reales, verifica un dominio propio en Resend
          y cambia <code>EMAIL_FROM</code>.
        </p>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Pueden recibir promociones"
          value={num(data.audienceCount)}
          hint="Aceptaron recibirlas y confirmaron su correo"
        />
        <Stat label="Promociones enviadas" value={num(campaigns.filter((c) => c.status !== 'FAILED').length)} />
        <Stat
          label="Último envío"
          value={campaigns[0]?.sentAt ? new Date(campaigns[0].sentAt).toLocaleDateString('es-CL') : '—'}
        />
      </section>

      <PromoComposer
        products={data.products}
        categories={data.categories}
        audienceCount={data.audienceCount}
        appUrl={appUrl}
        canSend={emailConfigured}
      />

      <section className="card-hs shadow-soft p-6">
        <Eyebrow>Historial</Eyebrow>
        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-taupe">Todavía no se ha enviado ninguna promoción.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand text-left text-taupe">
                  <th className="py-2 pr-3 text-[12px] font-medium">Fecha</th>
                  <th className="py-2 pr-3 text-[12px] font-medium">Asunto</th>
                  <th className="py-2 pr-3 text-[12px] font-medium">Estado</th>
                  <th className="py-2 pr-3 text-right text-[12px] font-medium">Destinatarios</th>
                  <th className="py-2 text-right text-[12px] font-medium">Fallidos</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const s = STATUS[c.status] ?? STATUS['SENDING']!;
                  return (
                    <tr key={c.id} className="border-b border-sand/40 last:border-0">
                      <td className="py-2.5 pr-3 text-taupe">
                        {new Date(c.sentAt ?? c.createdAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-soot">{c.subject}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`${s.className} text-[11px]`}>{s.label}</span>
                      </td>
                      <td className="price-mono py-2.5 pr-3 text-right text-soot">{num(c.recipientCount)}</td>
                      <td className="price-mono py-2.5 text-right text-taupe">{num(c.failedCount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
