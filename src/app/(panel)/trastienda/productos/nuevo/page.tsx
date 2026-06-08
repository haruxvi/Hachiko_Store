import { getSession } from '@/src/lib/auth/session';
import { getCategories } from '@/src/lib/services/catalog.service';
import ProductForm from '@/src/components/panel/ProductForm';

export default async function NuevoProductoPage() {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const categories = await getCategories(false);

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Nuevo producto</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
