// Piezas compartidas de las vistas del grupo Inteligencia. Siguen la línea
// editorial boutique del panel (Fraunces, soot/taupe/rust, .card-hs, .price-mono).

export const clp = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(n));
export const num = (n: number) => n.toLocaleString('es-CL');
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const monthLabel = (d: Date) => `${MONTHS_ES[new Date(d).getMonth()]} ${new Date(d).getFullYear()}`;

export function PageHeader({ title, subtitle, updated }: { title: string; subtitle: string; updated?: Date | null }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl">{title}</h1>
        <p className="editorial mt-1 text-[15px] text-taupe">{subtitle}</p>
      </div>
      {updated && (
        <p className="text-xs text-taupe">
          Actualizado {new Date(updated).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      )}
    </header>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <h2 className="editorial text-[15px] text-taupe">{children}</h2>;
}

export function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card-hs shadow-soft p-5">
      <p className="text-[13px] text-taupe">{label}</p>
      <p className={`price-mono mt-1.5 text-[25px] leading-none ${accent ? 'text-rust-dark' : 'text-soot'}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-taupe">{hint}</p>}
    </div>
  );
}
