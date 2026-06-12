import Link from 'next/link';
import { formatCLP } from '@/src/lib/format';

export interface ProductCardData {
  slug: string;
  name: string;
  nameKorean?: string | null;
  priceCLP: number;
  image?: string | null;
  stock?: number;
  lowStockThreshold?: number;
}

// Card de producto: Hangul pequeño arriba en taupe, nombre en soot,
// precio en mono. Hover: leve lift + sombra cálida.
export default function ProductCardHs({ product }: { product: ProductCardData }) {
  const low =
    product.stock !== undefined &&
    product.lowStockThreshold !== undefined &&
    product.stock > 0 &&
    product.stock <= product.lowStockThreshold;

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="card-hs group block overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-lift"
    >
      <div className="relative aspect-square bg-cream">
        {product.image ? (
          /* eslint-disable-next-line @next/next/no-img-element -- URLs externas sin host fijo; next/image exige remotePatterns */
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="ph ph-sand h-full w-full">
            <span className="ph-label">foto · {product.name.toLowerCase().slice(0, 24)}</span>
          </div>
        )}
        {product.stock === 0 && (
          <span className="chip-hs absolute left-3 top-3 bg-snow">Sin stock</span>
        )}
      </div>
      <div className="px-[18px] pb-[18px] pt-4">
        {product.nameKorean && (
          <div className="hangul mb-[3px] text-xs leading-tight text-taupe">
            {product.nameKorean}
          </div>
        )}
        <div className="mb-2 text-[15px] font-semibold leading-snug text-soot">{product.name}</div>
        <div className="flex items-baseline justify-between">
          <span className="price-mono text-sm text-soot">{formatCLP(product.priceCLP)}</span>
          {low && <span className="text-[11px] font-semibold text-rust">Quedan pocas</span>}
        </div>
      </div>
    </Link>
  );
}
