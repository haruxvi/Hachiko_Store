'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/src/components/ui/Icon';
import { PAGE_SIZES } from '@/src/lib/panel-list';

// Barra de búsqueda + filtros + "Mostrar N" de las listas del panel.
//
// Es un formulario GET normal: sin JavaScript igual funciona (Enter envía y la
// página se recarga con ?q=…). Con JavaScript, la búsqueda se aplica sola al
// dejar de escribir y los selectores al cambiarlos, sin recargar la página.
// Cualquier cambio vuelve a la página 1 (no se envía ?pagina).

export interface ToolbarFilter {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

const selectClass =
  'min-h-11 rounded-input border border-sand bg-snow py-2 pl-3 pr-8 text-[14px] font-medium text-soot transition focus:border-rust focus:outline-none focus:ring-[3px] focus:ring-rust/20';

export default function ListToolbar({
  basePath,
  query,
  perPage,
  searchLabel,
  placeholder,
  filters = [],
  clearable,
}: {
  basePath: string;
  query: string;
  perPage: number;
  searchLabel: string;
  placeholder: string;
  filters?: ToolbarFilter[];
  /** Hay búsqueda o filtros distintos al valor por defecto: se ofrece "Limpiar". */
  clearable: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    if (timer.current) clearTimeout(timer.current);
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) {
      const s = String(v).trim();
      if (s) params.set(k, s);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false }));
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={basePath}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="mb-5 flex flex-wrap items-end gap-3"
    >
      <label className="block min-w-[220px] flex-[1_1_280px]">
        <span className="mb-1.5 block text-xs font-medium text-taupe">{searchLabel}</span>
        <span className="relative block">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-taupe">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={placeholder}
            maxLength={100}
            autoComplete="off"
            onChange={() => {
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(apply, 350);
            }}
            className="input-hs min-h-11 !py-2 pl-10"
          />
        </span>
      </label>

      {filters.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1.5 block text-xs font-medium text-taupe">{f.label}</span>
          <select key={f.value} name={f.name} defaultValue={f.value} onChange={apply} className={selectClass}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-taupe">Mostrar</span>
        <select key={perPage} name="mostrar" defaultValue={String(perPage)} onChange={apply} className={selectClass}>
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} por página
            </option>
          ))}
        </select>
      </label>

      {/* Sin JavaScript, este botón aplica la búsqueda; con JavaScript sobra. */}
      <noscript>
        <button type="submit" className="btn-outline btn-sm min-h-11">
          Buscar
        </button>
      </noscript>

      <div className="flex min-h-11 items-center gap-3">
        {clearable && (
          <a
            href={basePath}
            onClick={(e) => {
              e.preventDefault();
              if (timer.current) clearTimeout(timer.current);
              // Los selectores se rearman solos con los valores por defecto (key);
              // el buscador no tiene key para no perder el foco al escribir.
              const input = formRef.current?.elements.namedItem('q');
              if (input instanceof HTMLInputElement) input.value = '';
              startTransition(() => router.replace(basePath, { scroll: false }));
            }}
            className="text-[13px] font-semibold text-soot underline decoration-rust decoration-2 underline-offset-4 hover:decoration-soot"
          >
            Limpiar
          </a>
        )}
        <span aria-live="polite" className="text-[13px] text-taupe">
          {pending ? 'Buscando…' : ''}
        </span>
      </div>
    </form>
  );
}
