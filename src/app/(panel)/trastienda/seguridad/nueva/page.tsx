import { getSession } from '@/src/lib/auth/session';
import IncidentForm from '@/src/components/panel/IncidentForm';

export default async function NuevaIncidenciaPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Registrar incidencia de seguridad</h1>
      <p className="text-sm text-gray-500 mb-6">
        Documenta el incidente con la mayor precisión posible: este registro sirve de respaldo
        ante una auditoría o una denuncia por delito informático.
      </p>
      <IncidentForm />
    </div>
  );
}
