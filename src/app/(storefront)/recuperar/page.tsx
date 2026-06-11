import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/src/lib/auth/session';
import ForgotPasswordForm from '@/src/components/storefront/ForgotPasswordForm';

export const metadata: Metadata = { title: 'Recuperar contraseña — Hachiko' };

export default async function RecuperarPage() {
  const session = await getSession();
  if (session) redirect('/');

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-rose-600 font-bold text-xl">
          Hachiko
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-2">Recuperar contraseña</h1>
        <p className="text-sm text-gray-500 mb-6">
          Te enviaremos un enlace por correo para crear una contraseña nueva.
        </p>
        <ForgotPasswordForm />
        <p className="text-sm text-gray-500 text-center mt-6">
          <Link href="/login" className="text-rose-600 hover:underline">
            ← Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
