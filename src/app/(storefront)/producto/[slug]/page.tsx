import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductBySlug } from '@/src/lib/services/catalog.service';
import AddToCartButton from '@/src/components/storefront/AddToCartButton';
import ProductGallery from '@/src/components/storefront/ProductGallery';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.active) return { title: 'Producto no encontrado — Hachiko' };

  const description = product.description.slice(0, 160);
  return {
    title: `${product.name} — Hachiko`,
    description,
    openGraph: {
      title: product.name,
      description,
      type: 'website',
      ...(product.images[0] ? { images: [{ url: product.images[0] }] } : {}),
    },
  };
}

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.active) notFound();

  // Datos estructurados para rich results de Google (precio y disponibilidad)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description.slice(0, 500),
    sku: product.sku,
    image: product.images,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CLP',
      price: product.priceCLP,
      availability:
        product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  const lowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Se escapa "<" para que un "</script>" dentro de la descripción del
          producto no pueda salir del bloque JSON-LD (defensa en profundidad) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="grid md:grid-cols-2 gap-12">
        <ProductGallery images={product.images} alt={product.name} />

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
            <>
              {lowStock && (
                <p className="text-sm text-amber-600 font-medium mb-3">
                  ¡Quedan pocas unidades!
                </p>
              )}
              <AddToCartButton product={{ id: product.id, name: product.name, priceCLP: product.priceCLP, image: product.images[0] ?? null }} />
            </>
          ) : (
            <button disabled className="bg-gray-100 text-gray-400 font-semibold py-3 px-8 rounded-full cursor-not-allowed">
              Sin stock
            </button>
          )}

          <p className="text-xs text-gray-400 mt-4">SKU: {product.sku}</p>
          <p className="text-xs text-gray-400">
            Despacho a domicilio (2–6 días hábiles) o retiro gratis en tienda — Recoleta, Santiago.
            Eliges al pagar.
          </p>
        </div>
      </div>
    </div>
  );
}
