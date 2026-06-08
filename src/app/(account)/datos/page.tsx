import { redirect } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import DataExportButton from '@/src/components/storefront/DataExportButton';

export default async function DatosPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">Mis datos personales</h1>
      <p className="text-gray-500 mb-8 text-sm">
        Derechos reconocidos por la Ley 21.719 de Protección de Datos Personales de Chile.
      </p>
      <div className="flex flex-col gap-4">
        <div className="border rounded-xl p-5">
          <h2 className="font-semibold mb-2">Exportar mis datos</h2>
          <p className="text-sm text-gray-500 mb-4">
            Descarga todos tus datos personales almacenados en Hachiko en formato JSON.
          </p>
          <DataExportButton />
        </div>
        <div className="border rounded-xl p-5">
          <h2 className="font-semibold mb-2">Eliminar mi cuenta</h2>
          <p className="text-sm text-gray-500 mb-4">
            Tu cuenta se desactivará de inmediato y los datos serán purgados en 30 días.
            Esta acción no es reversible.
          </p>
          <a
            href="/api/me/account"
            className="text-sm text-red-500 hover:underline font-medium"
          >
            Solicitar eliminación de cuenta →
          </a>
        </div>
      </div>
    </div>
  );
}
