// Carnet de socio: el elemento protagonista del perfil (el resto de la página es
// sereno a propósito). Inspirado en la papelería coreana: una tarjeta de cartulina
// amarilla, con la marca 회원증 ("carnet de socio") y un timbre de goma que cuenta
// algo real: si el correo está verificado, el carnet está sellado.
//
// Componente de servidor: no agrega JavaScript al navegador. El único movimiento
// es el timbre al cargar (CSS, `motion-safe`), que respeta "reducir movimiento".

const INK = '#B4642A'; // tinta del timbre: rust más profundo, se lee como sello real

function Stamp({ verified }: { verified: boolean }) {
  const arc = 'M60,60 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0';
  if (!verified) {
    // Sin verificar: solo el contorno punteado donde iría el sello.
    return (
      <svg viewBox="0 0 120 120" className="h-24 w-24 -rotate-[11deg] sm:h-28 sm:w-28" aria-hidden="true">
        <defs>
          <path id="stamp-arc-empty" d={arc} />
        </defs>
        <circle cx="60" cy="60" r="56" fill="none" stroke="#7A6552" strokeWidth="2" strokeDasharray="5 6" />
        <text fill="#7A6552" fontSize="10.5" fontWeight="700" letterSpacing="2.4">
          <textPath href="#stamp-arc-empty">CORREO SIN VERIFICAR ✶ HACHIKO ✶</textPath>
        </text>
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-24 w-24 -rotate-[11deg] mix-blend-multiply sm:h-28 sm:w-28 motion-safe:animate-[stamp-in_560ms_cubic-bezier(0.22,1,0.36,1)_250ms_both]"
      aria-hidden="true"
    >
      <defs>
        <path id="stamp-arc" d={arc} />
        {/* Grano de tinta: bordes apenas irregulares, como un timbre de goma real. */}
        <filter id="stamp-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="1.6" />
        </filter>
      </defs>
      <g filter="url(#stamp-ink)" fill={INK} stroke={INK} opacity="0.92">
        <circle cx="60" cy="60" r="56" fill="none" strokeWidth="3" />
        <circle cx="60" cy="60" r="31" fill="none" strokeWidth="1.6" />
        <text fontSize="10.5" fontWeight="700" letterSpacing="2.4" stroke="none">
          <textPath href="#stamp-arc">CORREO VERIFICADO ✶ HACHIKO ✶</textPath>
        </text>
        {/* La huella del logo (viewBox 32) centrada en el sello. */}
        <g transform="translate(40 40) scale(1.25)" stroke="none">
          <ellipse cx="11" cy="13" rx="2" ry="2.5" />
          <ellipse cx="21" cy="13" rx="2" ry="2.5" />
          <ellipse cx="13" cy="19" rx="1.6" ry="2" />
          <ellipse cx="19" cy="19" rx="1.6" ry="2" />
          <ellipse cx="16" cy="22" rx="3" ry="2.4" />
        </g>
      </g>
    </svg>
  );
}

export default function MemberCard({
  name,
  email,
  isSeller,
  memberSince,
  verified,
}: {
  name: string;
  email: string;
  isSeller: boolean;
  memberSince: Date;
  verified: boolean;
}) {
  const since = new Date(memberSince).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

  return (
    <section aria-label="Tu carnet de Hachiko" className="relative pt-2">
      <div className="relative overflow-hidden rounded-[28px] bg-butter px-7 pb-8 pt-6 shadow-[0_1px_2px_rgba(61,47,37,0.06),0_12px_28px_-10px_rgba(61,47,37,0.22),0_34px_64px_-34px_rgba(61,47,37,0.3)] sm:px-9 sm:pt-7 lg:-rotate-[1.2deg]">
        {/* Trama de puntos muy suave: textura de cartulina, no decoración. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(61,47,37,0.09)_1px,transparent_1px)] [background-size:14px_14px]"
        />

        {/* Solo la marca 회원증: el timbre ya dice HACHIKO, un logotipo más competiría con él. */}
        <p className="hangul relative text-sm text-soot/75" lang="ko">
          회원증
        </p>

        {/* El margen derecho reserva el lugar del timbre: un nombre o correo largo
            pasa a la línea siguiente en vez de quedar debajo del sello. */}
        <div className="relative mt-10 pr-24 sm:pr-32">
          <p className="max-w-[14ch] font-display text-[clamp(2.1rem,5.4vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.02em] text-soot [overflow-wrap:anywhere]">
            {name}
          </p>
          <p className="mt-3 break-all text-[15px] text-taupe-deep">{email}</p>
        </div>

        <div className="relative mt-8 flex flex-wrap items-end justify-between gap-3">
          <p className="editorial text-[17px] text-soot/85">En Hachiko desde {since}</p>
          <span className="rounded-chip bg-snow/75 px-3 py-1.5 text-xs font-semibold text-soot">
            {isSeller ? 'Cuenta de vendedor' : 'Cuenta de cliente'}
          </span>
        </div>

        <div className="absolute right-4 top-12 sm:right-7 sm:top-10">
          <Stamp verified={verified} />
          <span className="sr-only">{verified ? 'Correo verificado' : 'Correo sin verificar'}</span>
        </div>
      </div>
    </section>
  );
}
