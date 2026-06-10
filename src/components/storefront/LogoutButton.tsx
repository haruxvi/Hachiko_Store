'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className={className ?? 'text-sm text-gray-500 hover:text-red-600 hover:underline'}
    >
      Cerrar sesión
    </button>
  );
}
