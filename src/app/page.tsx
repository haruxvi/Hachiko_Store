import Link from 'next/link';
import { getProducts } from '@/src/lib/services/catalog.service';
import { getCategories } from '@/src/lib/services/catalog.service';
import { getSession } from '@/src/lib/auth/session';

export default async function HomePage() {
  const [{ products: featured }, categories, session] = await Promise.all([
    getProducts({ featured: true, limit: 8 }),
    getCategories(),
    getSession(),
  ]);

  return (
    <main>
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-rose-600 font-bold text-xl">
            Hachiko
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/catalogo" className="hover:text-rose-600">
              Catálogo
            </Link>
            <Link href="/carrito" className="hover:text-rose-600">
              Carrito
            </Link>
            {session ? (
              <>
                {session.role === 'SELLER' && (
                  <Link href="/trastienda" className="hover:text-rose-600">
                    Trastienda
                  </Link>
                )}
                <Link href="/perfil" className="hover:text-rose-600">
                  Mi cuenta
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-rose-600 text-white px-4 py-1.5 rounded-full hover:bg-rose-700"
              >
                Iniciar sesión
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-rose-50 py-20 px-6 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Productos Coreanos Auténticos
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
          Snacks, skincare, papelería y merch K-pop. Enviamos a todo Chile desde Recoleta.
        </p>
        <Link
          href="/catalogo"
          className="inline-block bg-rose-500 text-white font-semibold px-8 py-3 rounded-full hover:bg-rose-600 transition-colors"
        >
          Ver catálogo
        </Link>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-14">
          <h2 className="text-2xl font-bold mb-6">Categorías</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/catalogo?categoria=${cat.slug}`}
                className="border rounded-xl p-6 text-center font-medium hover:bg-rose-50 transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-20">
          <h2 className="text-2xl font-bold mb-6">Destacados</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {featured.map((p) => (
              <Link key={p.id} href={`/producto/${p.slug}`} className="group block">
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-3">
                  {p.images[0] ? (
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                      🛍️
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-sm line-clamp-2">{p.name}</h3>
                <p className="text-rose-600 font-bold mt-1">
                  ${p.priceCLP.toLocaleString('es-CL')}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t py-10 px-6 text-sm text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <p className="font-semibold text-gray-800 mb-2">Hachiko</p>
            <p>Tienda de productos coreanos — Santiago, Chile</p>
            <p>contacto@hachiko.cl</p>
          </div>
          <nav className="flex flex-col gap-1">
            <Link href="/legal/terminos" className="hover:underline">Términos y Condiciones</Link>
            <Link href="/legal/privacidad" className="hover:underline">Política de Privacidad</Link>
            <Link href="/legal/cookies" className="hover:underline">Política de Cookies</Link>
            <Link href="/legal/despacho" className="hover:underline">Política de Despacho</Link>
            <Link href="/legal/devoluciones" className="hover:underline">Cambios y Devoluciones</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
