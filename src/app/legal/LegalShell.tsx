import Link from 'next/link';
import Logo from '@/src/components/ui/Logo';
import Icon from '@/src/components/ui/Icon';
import POLICIES, { ORDER, getPolicy, type PolicySlug, type Section } from './policies';

// Layout editorial de las páginas legales (rediseño importado desde Claude
// Design). Barra superior slim + sidebar sticky (navegación entre políticas +
// índice de secciones + tarjeta de contacto) + columna de contenido con
// secciones numeradas. La navegación entre políticas usa rutas reales
// (/legal/*), así cada URL es directa y compartible.

function pad(n: number) {
  return String(n + 1).padStart(2, '0');
}

function anchorId(slug: PolicySlug, i: number) {
  return `${slug}-s${i + 1}`;
}

function SectionBlocks({ section }: { section: Section }) {
  return (
    <>
      {section.blocks.map((block, i) => {
        if (block.kind === 'p') {
          return (
            <p key={i} className="mt-3.5 font-body text-base leading-[1.7] text-soot first:mt-0">
              {block.content}
            </p>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={i} className="mt-3.5 flex flex-col gap-2.5 first:mt-0">
              {block.items.map((it, j) => (
                <li key={j} className="flex gap-3 font-body text-base leading-[1.6] text-soot">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-tan" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === 'steps') {
          return (
            <ol key={i} className="mt-3.5 flex flex-col gap-3 first:mt-0">
              {block.items.map((it, j) => (
                <li key={j} className="flex gap-3.5 font-body text-base leading-[1.6] text-soot">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-sand bg-cream font-mono text-xs text-soot">
                    {j + 1}
                  </span>
                  <span className="pt-px">{it}</span>
                </li>
              ))}
            </ol>
          );
        }
        // note
        return (
          <div
            key={i}
            className="mt-3.5 rounded-btn bg-blush px-4 py-3 font-body text-sm font-medium leading-[1.55] text-[#8A4A4A] first:mt-0"
          >
            {block.content}
          </div>
        );
      })}
    </>
  );
}

export default function LegalShell({ active }: { active: PolicySlug }) {
  const doc = getPolicy(active);

  return (
    <div className="min-h-screen bg-cream scroll-smooth">
      {/* ─── Barra superior slim ─── */}
      <div className="flex items-center gap-3 border-b border-sand bg-cream px-6 py-[18px] sm:px-12">
        <Logo size={26} />
        <span className="font-display text-xl font-bold tracking-[-0.02em] text-soot">hachiko</span>
        <Link href="/" className="btn-link ml-auto text-sm font-medium">
          <Icon name="chevronL" size={14} /> Volver a la tienda
        </Link>
      </div>

      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-start gap-12 px-6 py-14 sm:px-12 lg:grid-cols-[260px_1fr] lg:gap-[72px] lg:pb-24">
        {/* ─── SIDEBAR ─── */}
        <aside className="lg:sticky lg:top-8">
          <div className="mb-4 pl-0.5 font-editorial text-[13px] italic text-taupe">
            Lo legal, en claro
          </div>

          <nav className="mb-8 flex flex-col gap-0.5">
            {ORDER.map((slug) => {
              const on = slug === active;
              return (
                <Link
                  key={slug}
                  href={`/legal/${slug}`}
                  aria-current={on ? 'page' : undefined}
                  className={[
                    'relative rounded-chip border py-[9px] pl-4 pr-3.5 text-left font-body text-sm transition-colors',
                    on
                      ? 'border-sand bg-snow font-semibold text-soot'
                      : 'border-transparent font-medium text-taupe hover:text-soot',
                  ].join(' ')}
                >
                  {on && (
                    <span className="absolute inset-y-[9px] left-0 w-0.5 rounded-full bg-rust" />
                  )}
                  {POLICIES[slug].label}
                </Link>
              );
            })}
          </nav>

          {/* Índice de la política activa */}
          <div className="border-t border-sand pt-5">
            <div className="mb-3 font-body text-xs font-semibold text-taupe">En esta página</div>
            <ol className="flex flex-col gap-2">
              {doc.sections.map((s, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-[1.4] text-taupe">
                  <a
                    href={`#${anchorId(active, i)}`}
                    className="flex gap-2 transition-colors hover:text-soot"
                  >
                    <span className="mt-px shrink-0 font-mono text-[11px] text-rust">{pad(i)}</span>
                    <span>{s.h}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>

          {/* Tarjeta de contacto */}
          <div className="mt-7 rounded-card border border-sand bg-snow p-4">
            <div className="mb-1 font-body text-[13px] font-semibold text-soot">¿Dudas?</div>
            <div className="text-[13px] leading-[1.5] text-taupe">
              Escríbenos a{' '}
              <a
                href="mailto:contacto@hachiko.cl"
                className="font-medium text-rust hover:underline"
              >
                contacto@hachiko.cl
              </a>{' '}
              — respondemos en horario de barrio.
            </div>
          </div>
        </aside>

        {/* ─── CONTENIDO ─── */}
        <article className="min-w-0 max-w-[720px]">
          <header className="mb-10">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="chip-hs font-mono text-[11px] normal-case tracking-normal">
                {doc.meta}
              </span>
            </div>
            <h1 className="mb-5 font-display text-4xl font-bold leading-[1.05] tracking-[-0.025em] text-soot sm:text-5xl">
              {doc.title}
            </h1>
            <p className="max-w-[620px] font-editorial text-xl italic leading-[1.5] text-taupe">
              {doc.intro}
            </p>
            {doc.law && (
              <div className="mt-6 inline-flex items-center gap-2.5 rounded-btn border border-sand bg-snow px-4 py-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-rust" />
                <span className="font-body text-[13px] font-medium leading-[1.3] text-soot">
                  {doc.law}
                </span>
              </div>
            )}
          </header>

          {/* Secciones numeradas */}
          <div className="flex flex-col gap-10">
            {doc.sections.map((s, i) => (
              <section
                key={i}
                id={anchorId(active, i)}
                className="grid scroll-mt-24 grid-cols-[36px_1fr] gap-4 sm:grid-cols-[48px_1fr] sm:gap-5"
              >
                <div className="border-t-2 border-sand pt-[3px] font-mono text-[15px] font-medium text-rust">
                  {pad(i)}
                </div>
                <div className="border-t-2 border-sand pt-[3px]">
                  <h2 className="mb-3 font-display text-[22px] font-bold tracking-[-0.01em] text-soot">
                    {s.h}
                  </h2>
                  <SectionBlocks section={s} />
                </div>
              </section>
            ))}
          </div>

          {/* Enlaces cruzados a las otras políticas */}
          <div className="mt-14 border-t border-sand pt-7">
            <div className="mb-4 font-body text-[13px] text-taupe">Otras políticas</div>
            <div className="flex flex-wrap gap-2.5">
              {ORDER.filter((slug) => slug !== active).map((slug) => (
                <Link
                  key={slug}
                  href={`/legal/${slug}`}
                  className="chip-hs gap-2 px-3 py-2 text-[13px] normal-case tracking-normal text-soot transition-colors hover:border-rust/40"
                >
                  {POLICIES[slug].label} <Icon name="chevronR" size={12} />
                </Link>
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
