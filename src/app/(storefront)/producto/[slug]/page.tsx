import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/src/lib/services/catalog.service';
import AddToCartButton from '@/src/components/storefront/AddToCartButton';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.active) notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="grid md:grid-cols-2 gap-12">
        {/* Images */}
        <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl text-gray-300">
              🛍️
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <p className="text-sm text-rose-500 font-medium mb-2">{product.category.name}</p>
          <h1 className="text-3xl font-bold mb-1">{product.name}</h1>
          {product.nameKorean && (
            <p className="text-lg text-gray-400 mb-4">{product.nameKorean}</p>
          )}
          <p className="text-3xl font-bold text-rose-600 mb-6">
            ${product.priceCLP.toLocaleString('es-CL')}
            <span className="text-base font-normal text-gray-400 ml-2">IVA incluido</span>
          </p>
          <p className="text-gray-600 mb-8 leading-relaxed">{product.description}</p>

          {product.stock > 0 ? (
            <AddToCartButton product={{ id: product.id, name: product.name, priceCLP: product.priceCLP, image: product.images[0] ?? null }} />
          ) : (
            <button disabled className="bg-gray-100 text-gray-400 font-semibold py-3 px-8 rounded-full cursor-not-allowed">
              Sin stock
            </button>
          )}

          <p className="text-xs text-gray-400 mt-4">SKU: {product.sku}</p>
          <p className="text-xs text-gray-400">
            Despacho estimado: 2–5 días hábiles vía Starken
          </p>
        </div>
      </div>
    </div>
  );
}
