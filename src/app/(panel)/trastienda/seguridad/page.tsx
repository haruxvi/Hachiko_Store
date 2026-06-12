import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import {
  getSecurityOverview,
  getRecentSecurityEvents,
  listIncidents,
} from '@/src/lib/services/security.service';
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  SEVERITY_BADGE,
  STATUS_BADGE,
  AUDIT_ACTION_LABELS,
} from '@/src/components/panel/security-labels';

export const revalidate = 30;

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export default async function SeguridadPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const [overview, events, incidents] = await Promise.all([
    getSecurityOverview(),
    getRecentSecurityEvents(),
    listIncidents(),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-soot">
            Seguridad e incidencias
          </h1>
          <div className="editorial mt-1.5 text-[15px] leading-snug text-taupe">
            Monitoreo de ciberseguridad y registro auditable conforme a las Leyes 21.663, 21.459
            y 21.719.
          </div>
        </div>
        <Link href="/trastienda/seguridad/nueva" className="btn-primary btn-sm shrink-0">
          Registrar incidencia
        </Link>
      </header>

      {/* KPIs de monitoreo */}
      <section>
        <h2 className="editorial mb-3 text-sm text-taupe">Monitoreo</h2>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard
            label="Logins fallidos (24 h)"
            value={overview.failedLogins24h}
            alert={overview.failedLogins24h >= 10}
          />
          <KpiCard label="Logins fallidos (7 días)" value={overview.failedLogins7d} />
          <KpiCard label="Bloqueos de cuenta (7 días)" value={overview.lockouts7d} />
          <KpiCard
            label="Cuentas bloqueadas ahora"
            value={overview.lockedAccountsNow}
            alert={overview.lockedAccountsNow > 0}
          />
        </div>
      </section>

      {/* KPIs de cumplimiento */}
      <section>
        <h2 className="editorial mb-3 text-sm text-taupe">Incidencias y cumplimiento</h2>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard
            label="Incidencias abiertas"
            value={overview.openIncidents}
            alert={overview.openIncidents > 0}
          />
          <KpiCard
            label="Críticas sin resolver"
            value={overview.criticalIncidents}
            alert={overview.criticalIncidents > 0}
          />
          <KpiCard
            label="Eliminaciones pendientes (21.719)"
            value={overview.pendingDeletionRequests}
            alert={overview.pendingDeletionRequests > 0}
          />
          <KpiCard
            label="Exportaciones ARCO pendientes"
            value={overview.pendingExportRequests}
            alert={overview.pendingExportRequests > 0}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Incidencias */}
        <section className="overflow-hidden rounded-2xl border border-sand bg-snow">
          <h2 className="editorial bg-cream px-4 py-3 text-sm text-taupe">Incidencias</h2>
          {incidents.length === 0 ? (
            <p className="px-4 py-5 text-sm text-taupe">Sin incidencias registradas.</p>
          ) : (
            <table className="w-full border-collapse font-body text-sm">
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id} className="border-t border-sand transition hover:bg-cream/60">
                    <td className="price-mono px-4 py-3 align-middle text-[13px] text-taupe">
                      #{i.incidentNumber}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Link
                        href={`/trastienda/seguridad/${i.id}`}
                        className="text-[15px] font-medium leading-snug text-soot transition hover:text-rust hover:underline"
                      >
                        {i.title}
                      </Link>
                      <p className="mt-0.5 text-[13px] font-normal text-taupe">
                        {CATEGORY_LABELS[i.category]}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_BADGE[i.severity]}`}
                      >
                        {SEVERITY_LABELS[i.severity]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[i.status]}`}
                      >
                        {STATUS_LABELS[i.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Eventos de seguridad recientes */}
        <section className="overflow-hidden rounded-2xl border border-sand bg-snow">
          <h2 className="editorial bg-cream px-4 py-3 text-sm text-taupe">
            Eventos de seguridad recientes
          </h2>
          {events.length === 0 ? (
            <p className="px-4 py-5 text-sm text-taupe">Sin eventos registrados.</p>
          ) : (
            <table className="w-full border-collapse font-body text-sm">
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-t border-sand">
                    <td className="px-4 py-3 align-middle text-soot">
                      {AUDIT_ACTION_LABELS[ev.action] ?? ev.action}
                      {ev.ip && (
                        <span className="price-mono ml-2 text-xs text-taupe">IP {ev.ip}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-middle text-[13px] font-normal text-taupe">
                      {formatDateTime(ev.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <p className="border-t border-sand pt-4 text-xs font-normal text-taupe">
        La bitácora de cada incidencia es de solo escritura y está sellada con una cadena de
        hashes SHA-256: cualquier alteración posterior queda en evidencia. Este panel no muestra
        datos personales de clientes.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border px-[18px] py-4 ${
        alert ? 'border-rust/40 bg-tan/20' : 'border-sand bg-snow'
      }`}
    >
      <div className="mb-2.5 text-[13px] font-medium text-taupe">{label}</div>
      <div
        className={`price-mono text-[28px] leading-none tracking-[-0.02em] ${
          alert ? 'text-rust-dark' : 'text-soot'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
