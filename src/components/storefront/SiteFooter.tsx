import Link from 'next/link';

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="mb-3.5 font-display text-[15px] font-bold text-soot">{title}</div>
      <ul className="flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-taupe hover:text-rust">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-sand bg-cream px-6 pb-8 pt-16 sm:px-12">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-16 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-3 font-display text-lg font-bold text-soot">Carta del barrio</div>
            <p className="mb-4 max-w-[280px] text-sm text-taupe">
              Un correo al mes. Recetas, lanzamientos pequeños y las cosas raras que encontramos en
              Seúl.
            </p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="tu@correo.cl"
                aria-label="Email para el boletín"
                className="input-hs flex-1"
              />
              <button type="submit" className="btn-primary btn-sm !px-3.5 !py-2.5">
                Suscribir
              </button>
            </form>
          </div>
          <FooterCol
            title="Tienda"
            links={[
              { label: 'Catálogo completo', href: '/catalogo' },
              { label: 'Snacks', href: '/catalogo?categoria=snacks' },
              { label: 'Skincare', href: '/catalogo?categoria=skincare' },
              { label: 'Papelería', href: '/catalogo?categoria=papeleria' },
            ]}
          />
          <FooterCol
            title="Ayuda"
            links={[
              { label: 'Envíos a Chile', href: '/legal/despacho' },
              { label: 'Cambios y devoluciones', href: '/legal/devoluciones' },
              { label: 'Pago seguro', href: '/legal/terminos' },
              { label: 'Contacto', href: 'mailto:contacto@hachiko.cl' },
            ]}
          />
          <FooterCol
            title="Hachiko"
            links={[
              { label: 'Quiénes somos', href: '/#about' },
              { label: 'Términos y Condiciones', href: '/legal/terminos' },
              { label: 'Privacidad', href: '/legal/privacidad' },
              { label: 'Cookies', href: '/legal/cookies' },
            ]}
          />
        </div>
        <div className="flex flex-col items-start justify-between gap-6 border-t border-sand pt-8 sm:flex-row sm:items-end">
          <div className="font-display text-6xl font-bold leading-[0.9] tracking-[-0.04em] text-soot sm:text-8xl">
            hachiko<span className="text-rust">.</span>
          </div>
          <div className="text-[13px] text-taupe sm:text-right">
            <div>Hecho con cariño en Recoleta · 2026</div>
            <div className="price-mono mt-1 text-[11px]">RUT 76.123.456-7 · Patente 2024-04201</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
