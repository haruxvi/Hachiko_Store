import { getSession } from '@/src/lib/auth/session';
import IncidentForm from '@/src/components/panel/IncidentForm';

export default async function NuevaIncidenciaPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-soot">
          Registrar incidencia de seguridad
        </h1>
        <div className="editorial mt-1.5 text-[15px] leading-snug text-taupe">
          Documenta el incidente con la mayor precisión posible: este registro sirve de respaldo
          ante una auditoría o una denuncia por delito informático.
        </div>
      </header>
      <IncidentForm />
    </div>
  );
}
