import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductBySlug, getProducts } from '@/src/lib/services/catalog.service';
import AddToCartPanel from '@/src/components/storefront/AddToCartPanel';
import ProductGallery from '@/src/components/storefront/ProductGallery';
import ProductCardHs from '@/src/components/storefront/ProductCardHs';
import Icon from '@/src/components/ui/Icon';
import { formatCLP } from '@/src/lib/format';

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

// Acordeón sin JavaScript: details/summary estilizado según el sistema.
function AccordionRow({
  title,
  open,
  children,
}: {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group border-b border-sand">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between py-[18px] font-display text-[15px] font-semibold text-soot [&::-webkit-details-marker]:hidden">
        {title}
        <span className="group-open:hidden">
          <Icon name="plus" size={16} />
        </span>
        <span className="hidden group-open:inline">
          <Icon name="minus" size={16} />
        </span>
      </summary>
      <div className="pb-5 text-sm leading-[1.7] text-taupe">{children}</div>
    </details>
  );
}

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.active) notFound();

  const { products: related } = await getProducts({
    categorySlug: product.category.slug,
    limit: 5,
  });
  const suggestions = related.filter((p) => p.id !== product.id).slice(0, 4);

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

  return (
    <div className="mx-auto max-w-[1440px] px-6 pt-10 sm:px-12">
      {/* Se escapa "<" para que un "</script>" dentro de la descripción del
          producto no pueda salir del bloque JSON-LD (defensa en profundidad) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* Breadcrumb */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5 text-[13px] text-taupe">
        <Link href="/" className="hover:text-rust">
          Inicio
        </Link>
        <Icon name="chevronR" size={12} />
        <Link href={`/catalogo?categoria=${product.category.slug}`} className="hover:text-rust">
          {product.category.name}
        </Link>
        <Icon name="chevronR" size={12} />
        <span className="text-soot">{product.name}</span>
      </div>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] lg:gap-16">
        {/* Galería 60% */}
        <ProductGallery images={product.images} alt={product.name} />

        {/* Info 40% */}
        <div>
          {product.nameKorean && (
            <div className="hangul mb-2 text-sm text-taupe">{product.nameKorean}</div>
          )}
          <h1 className="mb-3 font-display text-3xl font-bold leading-[1.15] tracking-[-0.02em] text-soot lg:text-4xl">
            {product.name}
          </h1>

          <div className="mb-5 flex items-baseline gap-3">
            <span className="price-mono text-[32px] text-soot">{formatCLP(product.priceCLP)}</span>
            <span className="text-sm font-normal text-taupe">IVA incluido</span>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3 text-[13px] text-taupe">
            <span className="price-mono">SKU · {product.sku}</span>
            <span>·</span>
            {product.stock > 0 ? (
              <span className="flex items-center gap-1.5 text-mint-deep">
                <span className="h-1.5 w-1.5 rounded-full bg-mint-deep" />
                {product.stock <= product.lowStockThreshold
                  ? `Quedan ${product.stock} en bodega`
                  : `${product.stock} disponibles en bodega`}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-alert">
                <span className="h-1.5 w-1.5 rounded-full bg-alert" />
                Sin stock por ahora
              </span>
            )}
          </div>

          <p className="mb-8 text-[15px] leading-[1.75] text-soot">{product.description}</p>

          {product.stock > 0 ? (
            <AddToCartPanel
              product={{
                id: product.id,
                name: product.name,
                priceCLP: product.priceCLP,
                image: product.images[0] ?? null,
              }}
              maxQty={product.stock}
            />
          ) : (
            <button disabled className="btn-outline w-full cursor-not-allowed justify-center opacity-60">
              Sin stock — vuelve pronto
            </button>
          )}

          {/* Nota de despacho */}
          <div className="mt-6 flex items-start gap-3 rounded-btn border border-sand bg-cream p-4">
            <Icon name="truck" size={20} />
            <div className="text-[13px]">
              <div className="font-semibold text-soot">Despacho a domicilio o retiro en tienda</div>
              <div className="text-taupe">
                RM en 24–48 hrs, regiones 3–5 días hábiles · retiro gratis en Recoleta. Eliges al
                pagar.
              </div>
            </div>
          </div>

          {/* Acordeones */}
          <div className="mt-8">
            <AccordionRow title="Detalles" open>
              {product.description}
              {product.weightGrams ? ` Peso: ${product.weightGrams} g.` : ''}
            </AccordionRow>
            <AccordionRow title="Envío y plazos">
              Despacho desde Recoleta. RM: 24–48 hrs. Regiones: 3–5 días hábiles. También puedes
              retirar gratis en tienda — lo eliges al pagar.
            </AccordionRow>
            <AccordionRow title="Cambios y devoluciones">
              30 días para cambios en producto cerrado. Si llegó dañado, te respondemos en 24 hrs.{' '}
              <Link href="/legal/devoluciones" className="text-rust hover:underline">
                Ver política completa →
              </Link>
            </AccordionRow>
          </div>
        </div>
      </div>

      {/* También te puede gustar */}
      {suggestions.length > 0 && (
        <section className="pt-16 lg:pt-24">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-[28px] font-bold tracking-[-0.02em] text-soot">
              También te puede gustar
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {suggestions.map((p) => (
              <ProductCardHs
                key={p.id}
                product={{
                  slug: p.slug,
                  name: p.name,
                  nameKorean: p.nameKorean,
                  priceCLP: p.priceCLP,
                  image: p.images[0] ?? null,
                  stock: p.stock,
                  lowStockThreshold: p.lowStockThreshold,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
