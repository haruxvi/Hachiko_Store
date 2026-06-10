import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/src/lib/auth/session';
import LoginForm from '@/src/components/storefront/LoginForm';

export const metadata: Metadata = { title: 'Iniciar sesión — Hachiko' };

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(session.role === 'SELLER' ? '/trastienda' : '/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-rose-600 font-bold text-xl">
          Hachiko
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-6">Iniciar sesión</h1>
        <LoginForm />
      </div>
    </main>
  );
}
