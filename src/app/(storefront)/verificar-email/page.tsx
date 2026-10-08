import Link from 'next/link';
import type { Metadata } from 'next';
import VerifyEmailButton from '@/src/components/storefront/VerifyEmailButton';

export const metadata: Metadata = { title: 'Verificar correo — Hachiko' };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerificarEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-rust-ink font-bold text-xl">
          Hachiko
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-2">Confirma tu correo</h1>
        <p className="text-sm text-taupe mb-6">
          Presiona el botón para confirmar que esta dirección de correo es tuya.
        </p>
        {token ? (
          <VerifyEmailButton token={token} />
        ) : (
          <div className="bg-alert/[0.08] border border-alert/30 text-alert text-sm rounded-lg px-4 py-4">
            El enlace no es válido. Puedes pedir uno nuevo desde tu perfil.
          </div>
        )}
      </div>
    </main>
  );
}
