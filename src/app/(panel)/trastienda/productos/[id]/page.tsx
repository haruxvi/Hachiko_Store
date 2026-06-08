import { notFound } from 'next/navigation';
import { getSession } from '@/src/lib/auth/session';
import { getProductById, getCategories } from '@/src/lib/services/catalog.service';
import ProductForm from '@/src/components/panel/ProductForm';

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SELLER') return null;

  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(id),
    getCategories(false),
  ]);

  if (!product) notFound();

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Editar: {product.name}</h1>
      <ProductForm categories={categories} initial={product} />
    </div>
  );
}
