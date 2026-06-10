import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/src/lib/auth/session';
import RegisterForm from '@/src/components/storefront/RegisterForm';

export const metadata: Metadata = { title: 'Crear cuenta — Hachiko' };

export default async function RegistroPage() {
  const session = await getSession();
  if (session) redirect('/');

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="text-rose-600 font-bold text-xl">
          Hachiko
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-6">Crear cuenta</h1>
        <RegisterForm />
      </div>
    </main>
  );
}
