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
    <div className="space-y-8 max-w-4xl">
      <div>
        <Link href="/trastienda/seguridad" className="text-sm text-rose-600 hover:underline">
          ← Volver a seguridad
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold">
              Incidencia #{incident.incidentNumber}: {incident.title}
            </h1>
            <div className="flex gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_BADGE[incident.severity]}`}>
                Severidad: {SEVERITY_LABELS[incident.severity]}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[incident.status]}`}>
                {STATUS_LABELS[incident.status]}
              </span>
              {incident.affectsPersonalData && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  Afecta datos personales
                </span>
              )}
            </div>
          </div>
          <a
            href={`/api/security/incidents/${incident.id}/export`}
            className="border text-sm px-4 py-2 rounded-lg hover:bg-gray-50 shrink-0"
            download
          >
            Exportar informe para autoridad
          </a>
        </div>
      </div>

      {/* Ficha */}
      <section className="rounded-xl border bg-white p-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
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
          <p className="text-xs text-gray-400 mb-1">Descripción</p>
          <p className="whitespace-pre-wrap">{incident.description}</p>
        </div>
      </section>

      <IncidentActions incidentId={incident.id} currentStatus={incident.status} />

      {/* Bitácora */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase">
            Bitácora ({incident.events.length} eventos)
          </h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              chain.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {chain.valid
              ? 'Integridad verificada (cadena SHA-256 intacta)'
              : `⚠ Cadena rota en el evento ${chain.brokenAtSeq} — posible manipulación`}
          </span>
        </div>
        <ol className="space-y-3">
          {incident.events.map((ev) => (
            <li key={ev.id} className="rounded-lg border bg-white p-4 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">
                  {ev.seq}. {EVENT_TYPE_LABELS[ev.type]}
                </span>
                <span className="text-xs text-gray-400">{formatDateTime(ev.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap">{ev.detail}</p>
              <p className="text-[10px] text-gray-300 font-mono mt-2 truncate" title={ev.hash}>
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
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p>{value}</p>
    </div>
  );
}
