import Link from 'next/link';
import Icon from '@/src/components/ui/Icon';
import { hrefWith, pageWindow, type PageInfo } from '@/src/lib/panel-list';

// "Mostrando 21–40 de 57" + páginas numeradas, con el mismo estilo que la
// paginación del catálogo. Los links conservan búsqueda, filtros y "Mostrar N".
export default function PanelPagination({
  basePath,
  params,
  info,
  noun,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  info: PageInfo;
  noun: [singular: string, plural: string];
}) {
  const { page, totalPages, from, to, total } = info;
  const href = (n: number) => hrefWith(basePath, params, { pagina: n > 1 ? String(n) : undefined });

  return (
    <nav
      aria-label="Paginación"
      className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between"
    >
      <p className="text-[13px] text-taupe">
        {total === 0 ? (
          `0 ${noun[1]}`
        ) : (
          <>
            Mostrando <span className="price-mono text-soot">{from}–{to}</span> de{' '}
            <span className="price-mono text-soot">{total}</span> {total === 1 ? noun[0] : noun[1]}
          </>
        )}
      </p>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {page > 1 && (
            <Link href={href(page - 1)} aria-label="Página anterior" className="btn-outline btn-sm !p-2">
              <Icon name="chevronL" size={14} />
            </Link>
          )}
          {pageWindow(page, totalPages).map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-[13px] text-taupe">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={href(n)}
                aria-label={`Página ${n}`}
                aria-current={n === page ? 'page' : undefined}
                className={`inline-flex min-w-9 items-center justify-center rounded-chip px-3 py-2 text-[13px] font-medium transition ${
                  n === page ? 'bg-soot text-snow' : 'text-taupe-deep hover:bg-soot/5'
                }`}
              >
                {n}
              </Link>
            ),
          )}
          {page < totalPages && (
            <Link href={href(page + 1)} aria-label="Página siguiente" className="btn-outline btn-sm !p-2">
              <Icon name="chevronR" size={14} />
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
