import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import { getIncident, verifyIncidentChain } from '@/src/lib/services/security.service';
import IncidentActions from '@/src/components/panel/IncidentActions';
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  SEVERITY_BADGE,
  STATUS_BADGE,
  EVENT_TYPE_LABELS,
} from '@/src/components/panel/security-labels';

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function IncidenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const { id } = await params;
  const incident = await getIncident(id);
  if (!incident) notFound();

  const chain = verifyIncidentChain(incident.events);

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <Link
          href="/trastienda/seguridad"
          className="text-[13px] font-medium text-taupe transition hover:text-soot hover:underline"
        >
          ← Volver a seguridad
        </Link>
        <div className="mt-2 flex items-start justify-between gap-6">
          <div>
            <div className="price-mono text-sm text-rust"># {incident.incidentNumber}</div>
            <h1 className="mt-1 font-display text-[28px] font-bold leading-[1.15] tracking-[-0.015em] text-soot">
              {incident.title}
            </h1>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_BADGE[incident.severity]}`}
              >
                Severidad: {SEVERITY_LABELS[incident.severity]}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[incident.status]}`}
              >
                {STATUS_LABELS[incident.status]}
              </span>
              {incident.affectsPersonalData && (
                <span className="rounded-full bg-alert/15 px-2.5 py-0.5 text-xs font-medium text-alert">
                  Afecta datos personales
                </span>
              )}
            </div>
          </div>
          <a
            href={`/api/security/incidents/${incident.id}/export`}
            className="btn-outline btn-sm shrink-0"
            download
          >
            Exportar informe para autoridad
          </a>
        </div>
      </header>

      {/* Ficha */}
      <section className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-2xl border border-sand bg-snow p-5 text-sm">
        <Field label="Categoría" value={CATEGORY_LABELS[incident.category]} />
        <Field label="Detectada el" value={formatDateTime(incident.detectedAt)} />
        <Field label="Registrada el" value={formatDateTime(incident.createdAt)} />
        <Field
          label="Resuelta el"
          value={incident.resolvedAt ? formatDateTime(incident.resolvedAt) : '—'}
        />
        {incident.affectsPersonalData && (
          <Field
            label="Usuarios afectados (estimado)"
            value={incident.affectedUsersEstimate?.toString() ?? 'Sin estimar'}
          />
        )}
        {incident.authorityNotifiedAt && (
          <>
            <Field label="Autoridad notificada" value={incident.authorityName ?? '—'} />
            <Field label="Referencia de denuncia" value={incident.authorityReportRef ?? '—'} />
            <Field label="Notificada el" value={formatDateTime(incident.authorityNotifiedAt)} />
          </>
        )}
        <div className="col-span-2">
          <p className="mb-[3px] text-xs font-medium text-taupe">Descripción</p>
          <p className="whitespace-pre-wrap leading-[1.45] text-soot">{incident.description}</p>
        </div>
      </section>

      <IncidentActions incidentId={incident.id} currentStatus={incident.status} />

      {/* Bitácora */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="editorial text-sm text-taupe">
            Bitácora ({incident.events.length} eventos)
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              chain.valid ? 'bg-mint text-mint-deep' : 'bg-alert/15 text-alert'
            }`}
          >
            {chain.valid
              ? 'Integridad verificada (cadena SHA-256 intacta)'
              : `⚠ Cadena rota en el evento ${chain.brokenAtSeq} — posible manipulación`}
          </span>
        </div>
        <ol className="space-y-3">
          {incident.events.map((ev) => (
            <li key={ev.id} className="rounded-[14px] border border-sand bg-snow p-4 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-soot">
                  {ev.seq}. {EVENT_TYPE_LABELS[ev.type]}
                </span>
                <span className="text-xs font-normal text-taupe">
                  {formatDateTime(ev.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap leading-[1.45] text-soot">{ev.detail}</p>
              <p className="price-mono mt-2 truncate text-[10px] text-taupe/60" title={ev.hash}>
                sha256: {ev.hash}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-[3px] text-xs font-medium text-taupe">{label}</p>
      <p className="leading-[1.45] text-soot">{value}</p>
    </div>
  );
}
