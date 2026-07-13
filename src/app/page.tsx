import Link from 'next/link';
import { getProducts } from '@/src/lib/services/catalog.service';
import SiteHeader from '@/src/components/storefront/SiteHeader';
import SiteFooter from '@/src/components/storefront/SiteFooter';
import ProductCardHs from '@/src/components/storefront/ProductCardHs';
import Reveal from '@/src/components/storefront/Reveal';
import Icon, { type IconName } from '@/src/components/ui/Icon';

// La home lee sesión y catálogo: siempre se renderiza en runtime. Declararlo
// evita que el build intente prerenderizarla consultando la BD (el build no
// debe depender de una base de datos viva).
export const dynamic = 'force-dynamic';

// Home en modo lanzamiento (día 1): sin métricas fabricadas, sin temporalidad
// falsa. Promesas de cuidado, no de escala.
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
  const { products } = await getProducts({ limit: 8 });

  return (
    <>
      <SiteHeader />
      <main>
        {/* ──────── HERO — asimétrico 40/60, limpio, sin badges ──────── */}
        <section className="mx-auto max-w-[1440px] px-6 pb-8 pt-12 sm:px-12 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:gap-20">
            <div className="lg:pt-12">
              <h1 className="mb-6 font-display text-4xl font-bold leading-[1.08] tracking-[-0.02em] text-soot sm:text-5xl lg:text-6xl">
                Snacks, skincare y papelería traídos directo de{' '}
                <span className="editorial text-rust">Seúl</span>.
              </h1>
              <p className="mb-9 max-w-[440px] text-[17px] font-normal leading-[1.7] text-taupe">
                Cosas que extrañábamos y queríamos probar. Llegan en cantidades chicas a una bodega
                en Recoleta y de ahí salen a tu casa.
              </p>
              <div className="flex flex-wrap items-center gap-7">
                <Link href="/catalogo" className="btn-primary">
                  Explorar catálogo <Icon name="arrow" size={16} />
                </Link>
                <a href="#about" className="btn-link">
                  Cómo compramos
                </a>
              </div>
            </div>

            {/* Composición visual derecha — blob blush + área de marca */}
            <div className="relative hidden h-[560px] lg:block">
              <div className="absolute inset-0 -rotate-1 rounded-[200px_24px_24px_24px] bg-blush" />
              <div className="absolute bottom-6 left-8 right-4 top-4 overflow-hidden rounded-[200px_12px_12px_12px] bg-cream shadow-soft">
                <div className="ph h-full w-full !border-0">
                  <span className="ph-label">hero · still life de productos seleccionados</span>
                </div>
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
                title="Curaduría desde Seúl"
                text="Cada producto lo elegimos nosotros. No es dropshipping ni catálogo armado por algoritmo."
              />
            </Reveal>
            <Reveal delay={100}>
              <ValueProp
                icon="truck"
                title="Despacho a todo Chile"
                text="Vía Starken desde Recoleta. RM en 24–48 horas, regiones en 3–5 días hábiles."
              />
            </Reveal>
            <Reveal delay={200}>
              <ValueProp
                icon="lock"
                title="Pago seguro"
                text="Webpay y MercadoPago. No guardamos los datos de tu tarjeta en nuestros servidores."
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
                Lo que hay hoy en bodega. Llegan más cosas en las próximas semanas.
              </div>
            </div>
          </Reveal>
          {products.length === 0 ? (
            <p className="py-16 text-center text-taupe">
              Estamos subiendo los primeros productos. Volvé en unos días.
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
            <Reveal className="ph ph-sand h-72 rounded-3xl lg:h-[520px]">
              <span className="ph-label">foto editorial · bodega en Recoleta</span>
            </Reveal>
            <Reveal delay={120}>
              <div className="editorial mb-3.5 text-sm text-rust">Quiénes somos</div>
              <h2 className="mb-6 font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-soot lg:text-[34px]">
                Hachiko nace en Recoleta, en 2026.
              </h2>
              <p className="mb-4 text-base font-normal leading-[1.75] text-soot">
                Empezamos importando snacks que extrañábamos y crecimos hasta sumar skincare y
                papelería. Cada pedido lo empaca alguien que conoce el producto, no una bodega
                tercerizada.
              </p>
              <p className="mb-6 text-base font-normal leading-[1.75] text-taupe">
                Si algo no nos convence en la prueba, no lo subimos. Por eso el catálogo es chico —
                y por eso, esperamos, vale la pena.
              </p>
              <a href="mailto:contacto@hachiko.cl" className="btn-link">
                Escríbenos <Icon name="arrow" size={14} />
              </a>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
