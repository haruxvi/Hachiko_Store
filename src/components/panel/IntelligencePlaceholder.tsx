import Icon, { type IconName } from '@/src/components/ui/Icon';

/**
 * Estado "en construcción" de las páginas del grupo Inteligencia. Sigue la
 * línea editorial boutique del panel (cream/soot/rust, Fraunces, chips),
 * nunca un vacío gris genérico. Muestra qué contendrá la vista, en qué fase se
 * activa y cuántos registros hay hoy en su tabla derivada.
 */
export default function IntelligencePlaceholder({
  icon,
  title,
  description,
  phase,
  count,
  countLabel,
}: {
  icon: IconName;
  title: string;
  description: string;
  phase: string;
  count: number;
  countLabel: string;
}) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl">{title}</h1>
        <p className="editorial mt-1 max-w-2xl text-[15px] text-taupe">{description}</p>
      </header>

      <div className="card-hs shadow-soft flex flex-col items-center justify-center border-dashed px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tan-soft text-rust-dark">
          <Icon name={icon} size={24} />
        </span>
        <span className="chip-rust mt-5">{phase}</span>
        <p className="mt-4 max-w-md text-sm text-taupe">
          Esta vista se llenará cuando el pipeline de análisis calcule sus resultados. Hoy hay{' '}
          <span className="price-mono text-soot">{count.toLocaleString('es-CL')}</span>{' '}
          {countLabel}.
        </p>
      </div>
    </div>
  );
}
