import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import { getUserProfile } from '@/src/lib/services/auth.service';
import TwoFactorSetup from '@/src/components/storefront/TwoFactorSetup';
import LogoutButton from '@/src/components/storefront/LogoutButton';
import ResendVerificationButton from '@/src/components/storefront/ResendVerificationButton';

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const profile = await getUserProfile(session.sub);
  if (!profile) redirect('/login');

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <LogoutButton />
      </div>
      <p className="text-gray-500 mb-2 text-sm">
        {profile.email} · cuenta {profile.role === 'SELLER' ? 'de vendedor' : 'de cliente'}
      </p>

      {profile.emailVerified ? (
        <p className="text-xs text-green-600 mb-8">✓ Correo verificado</p>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-8 text-sm text-amber-800">
          Tu correo aún no está verificado: sin verificarlo podrías no recibir la confirmación
          de tus compras. <ResendVerificationButton />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Datos de la cuenta</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-500">Nombre</dt>
              <dd>{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Teléfono</dt>
              <dd>{profile.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Novedades por correo</dt>
              <dd>{profile.consentMarketing ? 'Sí' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Cuenta creada</dt>
              <dd>{new Date(profile.createdAt).toLocaleDateString('es-CL')}</dd>
            </div>
          </dl>
        </div>

        <TwoFactorSetup enabled={profile.totpEnabledAt !== null} />

        <div className="border rounded-xl p-5">
          <h2 className="font-semibold mb-2">Mis datos personales</h2>
          <p className="text-sm text-gray-500 mb-3">
            Exportar tus datos o solicitar la eliminación de tu cuenta (Ley 21.719).
          </p>
          <Link href="/datos" className="text-sm text-rose-600 hover:underline">
            Ir a gestión de datos →
          </Link>
        </div>

        {profile.role === 'SELLER' && (
          <div className="border rounded-xl p-5">
            <h2 className="font-semibold mb-2">Panel de vendedor</h2>
            <Link href="/trastienda" className="text-sm text-rose-600 hover:underline">
              Ir a la trastienda →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
