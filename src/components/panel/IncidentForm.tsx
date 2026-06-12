'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IncidentCategory, IncidentSeverity } from '@prisma/client';
import { createIncidentAction } from '@/src/actions/security';
import { CATEGORY_LABELS, SEVERITY_LABELS } from '@/src/components/panel/security-labels';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-taupe">
      {children}
    </label>
  );
}

export default function IncidentForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [affectsPersonalData, setAffectsPersonalData] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const estimate = fd.get('affectedUsersEstimate') as string;

    const result = await createIncidentAction({
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      category: fd.get('category') as IncidentCategory,
      severity: fd.get('severity') as IncidentSeverity,
      detectedAt: new Date(fd.get('detectedAt') as string),
      affectsPersonalData,
      affectedUsersEstimate: estimate ? Number(estimate) : undefined,
    });

    if (result.ok) {
      router.push(`/trastienda/seguridad/${result.id}`);
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-btn border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert">
          {error}
        </div>
      )}

      <div>
        <FieldLabel>Título</FieldLabel>
        <input
          name="title"
          required
          minLength={5}
          maxLength={200}
          placeholder="Ej.: Intentos masivos de acceso a cuentas de clientes"
          className="input-hs"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Categoría</FieldLabel>
          <select name="category" required className="input-hs">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Severidad</FieldLabel>
          <select name="severity" required className="input-hs">
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <FieldLabel>Fecha y hora de detección</FieldLabel>
        <input name="detectedAt" type="datetime-local" required className="input-hs" />
      </div>

      <div>
        <FieldLabel>Descripción de los hechos</FieldLabel>
        <textarea
          name="description"
          required
          minLength={10}
          rows={5}
          placeholder="Qué se detectó, cómo, sistemas involucrados, acciones inmediatas tomadas…"
          className="input-hs"
        />
      </div>

      <div className="space-y-3 rounded-btn border border-rust/40 bg-tan/20 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-soot">
          <input
            type="checkbox"
            checked={affectsPersonalData}
            onChange={(e) => setAffectsPersonalData(e.target.checked)}
            className="accent-rust"
          />
          La incidencia afecta datos personales de clientes
        </label>
        {affectsPersonalData && (
          <>
            <p className="text-xs font-normal text-rust-dark">
              Ley 21.719: la vulneración de datos personales debe notificarse a la Agencia de
              Protección de Datos Personales y, si hay riesgo para los titulares, también a los
              afectados.
            </p>
            <div>
              <FieldLabel>Estimación de usuarios afectados</FieldLabel>
              <input name="affectedUsersEstimate" type="number" min={0} className="input-hs" />
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={loading} className="btn-primary btn-sm disabled:opacity-50">
          {loading ? 'Registrando...' : 'Registrar incidencia'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-outline btn-sm">
          Cancelar
        </button>
      </div>

      <p className="text-xs font-normal text-taupe">
        El registro queda sellado en una bitácora inalterable. No incluyas datos personales de
        clientes en el título ni en la descripción; usa identificadores internos.
      </p>
    </form>
  );
}
