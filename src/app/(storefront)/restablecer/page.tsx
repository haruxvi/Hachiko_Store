import Link from 'next/link';
import type { Metadata } from 'next';
import ResetPasswordForm from '@/src/components/storefront/ResetPasswordForm';

export const metadata: Metadata = { title: 'Restablecer contraseña — Hachiko' };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function RestablecerPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-rust-ink font-bold text-xl">
          Hachiko
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-6">Crear contraseña nueva</h1>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="bg-alert/[0.08] border border-alert/30 text-alert text-sm rounded-lg px-4 py-4">
            El enlace no es válido. Solicita uno nuevo desde{' '}
            <Link href="/recuperar" className="underline font-medium">
              recuperar contraseña
            </Link>
            .
          </div>
        )}
      </div>
    </main>
  );
}
