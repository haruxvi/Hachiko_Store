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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Seguridad e incidencias</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitoreo de ciberseguridad y registro auditable conforme a las Leyes 21.663,
            21.459 y 21.719.
          </p>
        </div>
        <Link
          href="/trastienda/seguridad/nueva"
          className="bg-rose-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-rose-700"
        >
          Registrar incidencia
        </Link>
      </div>

      {/* KPIs de monitoreo */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Monitoreo</h2>
        <div className="grid grid-cols-4 gap-4">
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
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
          Incidencias y cumplimiento
        </h2>
        <div className="grid grid-cols-4 gap-4">
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

      <div className="grid grid-cols-2 gap-8">
        {/* Incidencias */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Incidencias</h2>
          {incidents.length === 0 ? (
            <p className="text-sm text-gray-400">Sin incidencias registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-gray-400">#{i.incidentNumber}</td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/trastienda/seguridad/${i.id}`}
                        className="text-rose-600 hover:underline"
                      >
                        {i.title}
                      </Link>
                      <p className="text-xs text-gray-400">{CATEGORY_LABELS[i.category]}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_BADGE[i.severity]}`}>
                        {SEVERITY_LABELS[i.severity]}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[i.status]}`}>
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
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
            Eventos de seguridad recientes
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400">Sin eventos registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      {AUDIT_ACTION_LABELS[ev.action] ?? ev.action}
                      {ev.ip && <span className="text-xs text-gray-400 ml-2">IP {ev.ip}</span>}
                    </td>
                    <td className="py-2 text-right text-xs text-gray-400">
                      {formatDateTime(ev.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <p className="text-xs text-gray-400 border-t pt-4">
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
    <div className={`rounded-xl border p-4 ${alert ? 'border-amber-300 bg-amber-50' : 'bg-white'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
