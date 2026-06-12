'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IncidentStatus, IncidentEventType } from '@prisma/client';
import {
  addIncidentNoteAction,
  changeIncidentStatusAction,
  registerAuthorityReportAction,
} from '@/src/actions/security';
import { STATUS_LABELS } from '@/src/components/panel/security-labels';

// Transiciones permitidas — debe coincidir con STATUS_FLOW del servicio
const NEXT_STATUSES: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['INVESTIGATING', 'CONTAINED', 'REPORTED', 'RESOLVED'],
  INVESTIGATING: ['CONTAINED', 'REPORTED', 'RESOLVED'],
  CONTAINED: ['INVESTIGATING', 'REPORTED', 'RESOLVED'],
  REPORTED: ['INVESTIGATING', 'CONTAINED', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'INVESTIGATING'],
  CLOSED: [],
};

type Tab = 'note' | 'status' | 'authority';

export default function IncidentActions({
  incidentId,
  currentStatus,
}: {
  incidentId: string;
  currentStatus: IncidentStatus;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('note');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nextStatuses = NEXT_STATUSES[currentStatus];

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setLoading(true);
    setError('');
    const result = await action();
    if (result.ok) {
      router.refresh();
      setLoading(false);
    } else {
      setError(result.error ?? 'Error');
      setLoading(false);
    }
  }

  if (currentStatus === 'CLOSED') {
    return (
      <p className="rounded-[14px] border border-sand bg-cream p-4 text-sm text-taupe">
        Incidencia cerrada: la bitácora queda sellada y no admite más eventos de gestión.
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-sand bg-snow p-5">
      <div className="mb-4 flex gap-2">
        <TabButton active={tab === 'note'} onClick={() => setTab('note')}>
          Agregar a bitácora
        </TabButton>
        <TabButton active={tab === 'status'} onClick={() => setTab('status')}>
          Cambiar estado
        </TabButton>
        <TabButton active={tab === 'authority'} onClick={() => setTab('authority')}>
          Registrar denuncia
        </TabButton>
      </div>

      {error && (
        <div className="mb-4 rounded-btn border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert">
          {error}
        </div>
      )}

      {tab === 'note' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void run(() =>
              addIncidentNoteAction({
                incidentId,
                detail: fd.get('detail') as string,
                type: fd.get('type') as Extract<IncidentEventType, 'NOTE' | 'EVIDENCE'>,
              }),
            );
            e.currentTarget.reset();
          }}
          className="space-y-3"
        >
          <select name="type" className="input-hs max-w-xs">
            <option value="NOTE">Nota de seguimiento</option>
            <option value="EVIDENCE">Evidencia (logs, capturas, referencias)</option>
          </select>
          <textarea
            name="detail"
            required
            minLength={3}
            rows={3}
            placeholder="Detalle de la nota o referencia a la evidencia…"
            className="input-hs"
          />
          <SubmitButton loading={loading}>Agregar a la bitácora</SubmitButton>
        </form>
      )}

      {tab === 'status' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void run(() =>
              changeIncidentStatusAction({
                incidentId,
                newStatus: fd.get('newStatus') as IncidentStatus,
                detail: fd.get('detail') as string,
              }),
            );
          }}
          className="space-y-3"
        >
          <select name="newStatus" required className="input-hs max-w-xs">
            {nextStatuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <textarea
            name="detail"
            required
            minLength={3}
            rows={2}
            placeholder="Justificación del cambio de estado…"
            className="input-hs"
          />
          <SubmitButton loading={loading}>Cambiar estado</SubmitButton>
        </form>
      )}

      {tab === 'authority' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void run(() =>
              registerAuthorityReportAction({
                incidentId,
                authorityName: fd.get('authorityName') as string,
                reportRef: fd.get('reportRef') as string,
              }),
            );
          }}
          className="space-y-3"
        >
          <p className="text-xs font-normal text-taupe">
            Registra aquí la denuncia o notificación ya presentada ante la autoridad (Agencia de
            Protección de Datos Personales, CSIRT Nacional, PDI Cibercrimen o Fiscalía). El
            informe exportable sirve como respaldo técnico de la denuncia.
          </p>
          <input
            name="authorityName"
            required
            minLength={3}
            placeholder="Autoridad (ej.: PDI — Brigada de Cibercrimen)"
            className="input-hs"
          />
          <input
            name="reportRef"
            required
            placeholder="N° de denuncia / referencia del trámite"
            className="input-hs"
          />
          <SubmitButton loading={loading}>Registrar denuncia</SubmitButton>
        </form>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-chip px-3.5 py-2 text-[13px] font-medium transition ${
        active
          ? 'bg-rust text-snow'
          : 'border border-sand text-taupe hover:border-soot hover:text-soot'
      }`}
    >
      {children}
    </button>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading} className="btn-primary btn-sm disabled:opacity-50">
      {loading ? 'Guardando...' : children}
    </button>
  );
}
