import { randomInt } from 'node:crypto';
import Link from 'next/link';
import { getProducts } from '@/src/lib/services/catalog.service';
import SiteHeader from '@/src/components/storefront/SiteHeader';
import SiteFooter from '@/src/components/storefront/SiteFooter';
import ProductCardHs from '@/src/components/storefront/ProductCardHs';
import RotatingProductHero from '@/src/components/storefront/RotatingProductHero';
import Reveal from '@/src/components/storefront/Reveal';
import Icon, { type IconName } from '@/src/components/ui/Icon';

// La home lee sesión y catálogo: siempre se renderiza en runtime. Declararlo
// evita que el build intente prerenderizarla consultando la BD (el build no
// debe depender de una base de datos viva).
export const dynamic = 'force-dynamic';

// Inicio de la demostración académica: funciones observables y datos de prueba
// identificados como tales.
function ValueProp({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div>
      <div className="mb-4 text-soot">
        <Icon name={icon} size={22} stroke={1.5} />
      </div>
      <div className="mb-2 text-sm font-semibold text-soot">{title}</div>
      <p className="text-[13px] font-normal leading-relaxed text-taupe">{text}</p>
    </div>
  );
}

export default async function HomePage() {
  const { products: catalogProducts } = await getProducts({ limit: 40 });
  const products = catalogProducts.slice(0, 8);
  const heroProducts = catalogProducts.flatMap((product) => {
    const image = product.images.find((url) => url.trim().length > 0);
    return product.stock > 0 && image
      ? [{ slug: product.slug, name: product.name, image }]
      : [];
  });
  const initialHeroIndex = heroProducts.length > 0 ? randomInt(heroProducts.length) : 0;

  return (
    <>
      <SiteHeader />
      <main>
        {/* ──────── HERO — asimétrico 40/60, limpio, sin badges ──────── */}
        <section className="mx-auto max-w-[1440px] px-6 pb-8 pt-12 sm:px-12 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:gap-20">
            <div className="lg:pt-12">
              <h1 className="mb-6 font-display text-4xl font-bold leading-[1.08] tracking-[-0.02em] text-soot sm:text-5xl lg:text-6xl">
                Compra fácil para tus clientes.{' '}
                <span className="editorial text-rust-ink">Gestión clara</span> para tu tienda.
              </h1>
              <p className="mb-9 max-w-[440px] text-[17px] font-normal leading-[1.7] text-taupe">
                Hachiko Store reúne catálogo, carrito, pagos y seguimiento de pedidos. La trastienda
                conecta productos, inventario y despachos en una sola plataforma.
              </p>
              <div className="flex flex-wrap items-center gap-7">
                <Link href="/catalogo" className="btn-primary">
                  Explorar catálogo <Icon name="arrow" size={16} />
                </Link>
                <a href="#about" className="btn-link">
                  Conoce el proyecto
                </a>
              </div>
            </div>

            {/* Fotos del catálogo que cambian automáticamente */}
            <div className="relative h-[360px] sm:h-[460px] lg:h-[560px]">
              <div className="absolute inset-0 -rotate-1 rounded-[200px_24px_24px_24px] bg-blush" />
              <div className="absolute bottom-6 left-8 right-4 top-4 overflow-hidden rounded-[200px_12px_12px_12px] bg-cream shadow-soft">
                <RotatingProductHero products={heroProducts} initialIndex={initialHeroIndex} />
              </div>
            </div>
          </div>
        </section>

        {/* ──────── 3 VALUE PROPS — texto sobre cream, sin cards ──────── */}
        <section className="mx-auto max-w-[1240px] px-6 pt-12 sm:px-12 lg:pt-20">
          <div className="grid grid-cols-1 gap-10 border-y border-sand py-12 sm:grid-cols-3 lg:gap-16">
            <Reveal delay={0}>
              <ValueProp
                icon="search"
                title="Compra en un solo lugar"
                text="Explora los productos, arma tu carrito y consulta el estado de tus pedidos."
              />
            </Reveal>
            <Reveal delay={100}>
              <ValueProp
                icon="truck"
                title="Operación conectada"
                text="La trastienda reúne pedidos, inventario y preparación de despachos."
              />
            </Reveal>
            <Reveal delay={200}>
              <ValueProp
                icon="sliders"
                title="Datos para decidir"
                text="Indicadores y pronósticos apoyan la planificación de demanda y reposición."
              />
            </Reveal>
          </div>
        </section>

        {/* ──────── CATÁLOGO — título neutro, todo lo que hay ──────── */}
        <section className="mx-auto max-w-[1240px] px-6 pt-16 sm:px-12 lg:pt-24">
          <Reveal>
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-soot lg:text-4xl">
                Catálogo
              </h2>
              <div className="editorial text-[15px] text-taupe">
                Productos disponibles para explorar en esta demostración.
              </div>
            </div>
          </Reveal>
          {products.length === 0 ? (
            <p className="py-16 text-center text-taupe">
              Estamos preparando el catálogo. Vuelve pronto.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {products.map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 3) * 80}>
                  <ProductCardHs
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
                </Reveal>
              ))}
            </div>
          )}
          <div className="mt-8 text-center">
            <Link href="/catalogo" className="btn-link">
              Ver el catálogo completo <Icon name="arrow" size={14} />
            </Link>
          </div>
        </section>

        {/* ──────── QUIÉNES SOMOS — editorial honesto, atemporal ──────── */}
        <section id="about" className="mx-auto max-w-[1240px] px-6 pt-20 sm:px-12 lg:pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-[5fr_4fr] lg:gap-20">
            <Reveal className="flex h-72 flex-col justify-center gap-5 rounded-3xl bg-sand px-8 text-soot lg:h-[520px] lg:px-12">
              <div className="editorial text-xl text-rust-ink">Hachiko Store</div>
              <p className="font-display text-3xl font-bold leading-tight lg:text-4xl">
                Catálogo, compras y gestión en una sola plataforma.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div className="editorial mb-3.5 text-sm text-rust-ink">Quiénes somos</div>
              <h2 className="mb-6 font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-soot lg:text-[34px]">
                Una plataforma pensada para una pyme.
              </h2>
              <p className="mb-4 text-base font-normal leading-[1.75] text-soot">
                Este proyecto de título acerca la tienda a sus clientes y permite al equipo gestionar
                productos, pedidos, inventario y despachos desde la misma aplicación.
              </p>
              <p className="mb-6 text-base font-normal leading-[1.75] text-taupe">
                Para demostrar el análisis de datos usamos pedidos sintéticos desde 2024. Los modelos
                ayudan a estimar demanda y reposición; las decisiones siguen a cargo de las personas.
              </p>
              <Link href="/catalogo" className="btn-link">
                Ver productos <Icon name="arrow" size={14} />
              </Link>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
