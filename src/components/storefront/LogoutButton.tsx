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
      className={className ?? 'text-sm text-taupe hover:text-alert hover:underline'}
    >
      Cerrar sesión
    </button>
  );
}
