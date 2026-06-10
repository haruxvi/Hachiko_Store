'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IncidentCategory, IncidentSeverity } from '@prisma/client';
import { createIncidentAction } from '@/src/actions/security';
import { CATEGORY_LABELS, SEVERITY_LABELS } from '@/src/components/panel/security-labels';

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
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
        <input
          name="title"
          required
          minLength={5}
          maxLength={200}
          placeholder="Ej.: Intentos masivos de acceso a cuentas de clientes"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <select name="category" required className="w-full border rounded-lg px-3 py-2 text-sm">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Severidad</label>
          <select name="severity" required className="w-full border rounded-lg px-3 py-2 text-sm">
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fecha y hora de detección
        </label>
        <input
          name="detectedAt"
          type="datetime-local"
          required
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción de los hechos
        </label>
        <textarea
          name="description"
          required
          minLength={10}
          rows={5}
          placeholder="Qué se detectó, cómo, sistemas involucrados, acciones inmediatas tomadas…"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={affectsPersonalData}
            onChange={(e) => setAffectsPersonalData(e.target.checked)}
          />
          La incidencia afecta datos personales de clientes
        </label>
        {affectsPersonalData && (
          <>
            <p className="text-xs text-amber-700">
              Ley 21.719: la vulneración de datos personales debe notificarse a la Agencia de
              Protección de Datos Personales y, si hay riesgo para los titulares, también a los
              afectados.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimación de usuarios afectados
              </label>
              <input
                name="affectedUsersEstimate"
                type="number"
                min={0}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="bg-rose-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-rose-700 disabled:opacity-50"
        >
          {loading ? 'Registrando...' : 'Registrar incidencia'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border text-sm px-6 py-2 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>

      <p className="text-xs text-gray-400">
        El registro queda sellado en una bitácora inalterable. No incluyas datos personales de
        clientes en el título ni en la descripción; usa identificadores internos.
      </p>
    </form>
  );
}
