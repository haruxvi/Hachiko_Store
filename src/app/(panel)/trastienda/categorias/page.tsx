import { getSession } from '@/src/lib/auth/session';
import { getCategories } from '@/src/lib/services/catalog.service';
import CategoryManager from '@/src/components/panel/CategoryManager';

export const revalidate = 0;

export default async function CategoriasPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const categories = await getCategories(false);

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Categorías</h1>
      <CategoryManager initialCategories={categories} />
    </div>
  );
}
