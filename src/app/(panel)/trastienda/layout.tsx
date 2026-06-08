import Link from 'next/link';
import { getSession } from '@/src/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r bg-gray-50 p-6 flex flex-col gap-1 shrink-0">
        <p className="font-bold text-rose-600 mb-6">Hachiko · Trastienda</p>
        <Link href="/trastienda" className="text-sm px-3 py-2 rounded-lg hover:bg-rose-50">
          Dashboard
        </Link>
        <Link href="/trastienda/ordenes" className="text-sm px-3 py-2 rounded-lg hover:bg-rose-50">
          Órdenes para despachar
        </Link>
        <Link href="/trastienda/productos" className="text-sm px-3 py-2 rounded-lg hover:bg-rose-50">
          Productos
        </Link>
        <Link href="/trastienda/categorias" className="text-sm px-3 py-2 rounded-lg hover:bg-rose-50">
          Categorías
        </Link>
        <Link href="/trastienda/inventario" className="text-sm px-3 py-2 rounded-lg hover:bg-rose-50">
          Inventario
        </Link>
        <div className="mt-auto">
          <p className="text-xs text-gray-400">{session.email}</p>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
