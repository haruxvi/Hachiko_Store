// Mascota Shiba — dibujo de línea simple, paleta pastel.
// Cuerpo tan, hocico/panza snow, orejas internas y lengua petal, outline cocoa 2.5px.
// Aparece SOLO en 404, carrito vacío y confirmación de compra — su escasez la hace memorable.

export type ShibaMood = 'idle' | 'sleep' | 'happy';

const STROKE = '#3D2F25'; // cocoa
const BODY = '#F5C9A0'; // tan
const BELLY = '#FFFFFF'; // snow
const INNER_EAR = '#F4A8A8'; // petal-deep
const CHEEK = '#FFD4D4'; // blush
const SW = 2.5;

export default function Shiba({ size = 200, mood = 'idle' }: { size?: number; mood?: ShibaMood }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 200 180" fill="none" aria-hidden="true">
      {/* Orejas externas — tan */}
      <path d="M48 52 L62 22 L80 50 Z" fill={BODY} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M152 52 L138 22 L120 50 Z" fill={BODY} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      {/* Orejas internas — petal-deep */}
      <path d="M58 44 L64 30 L73 44 Z" fill={INNER_EAR} />
      <path d="M142 44 L136 30 L127 44 Z" fill={INNER_EAR} />

      {/* Cara — tan arriba, máscara blanca al frente (firma del Shiba real) */}
      <circle cx="100" cy="95" r="55" fill={BODY} stroke={STROKE} strokeWidth={SW} />
      <path d="M72 100 Q100 138 128 100 Q116 125 100 125 Q84 125 72 100 Z" fill={BELLY} />

      {/* Hocico */}
      <ellipse cx="100" cy="110" rx="22" ry="16" fill={BELLY} stroke={STROKE} strokeWidth={SW * 0.7} />

      {/* Ojos */}
      {mood === 'sleep' ? (
        <>
          <path d="M76 92 Q82 96 88 92" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
          <path d="M112 92 Q118 96 124 92" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
        </>
      ) : mood === 'happy' ? (
        <>
          <path d="M76 96 Q82 88 88 96" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
          <path d="M112 96 Q118 88 124 96" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="82" cy="92" r="3.5" fill={STROKE} />
          <circle cx="118" cy="92" r="3.5" fill={STROKE} />
          <circle cx="80.5" cy="90.5" r="1" fill={BELLY} />
          <circle cx="116.5" cy="90.5" r="1" fill={BELLY} />
        </>
      )}

      {/* Nariz */}
      <ellipse cx="100" cy="104" rx="4" ry="3" fill={STROKE} />

      {/* Boca + lengua (lengua solo en happy) */}
      {mood === 'sleep' ? (
        <path d="M96 118 Q100 120 104 118" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
      ) : mood === 'happy' ? (
        <>
          <path d="M100 107 L100 113" stroke={STROKE} strokeWidth={SW * 0.8} strokeLinecap="round" />
          <path d="M100 113 Q90 122 84 117" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
          <path d="M100 113 Q110 122 116 117" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
          <path
            d="M96 118 Q100 124 104 118 Q104 122 100 122 Q96 122 96 118 Z"
            fill={INNER_EAR}
            stroke={STROKE}
            strokeWidth={SW * 0.6}
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path d="M100 107 L100 113" stroke={STROKE} strokeWidth={SW * 0.8} strokeLinecap="round" />
          <path d="M100 113 Q92 120 86 116" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
          <path d="M100 113 Q108 120 114 116" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
        </>
      )}

      {/* Mejillas — blush */}
      <ellipse cx="68" cy="110" rx="6" ry="3.5" fill={CHEEK} opacity="0.75" />
      <ellipse cx="132" cy="110" rx="6" ry="3.5" fill={CHEEK} opacity="0.75" />

      {/* z's de sueño */}
      {mood === 'sleep' && (
        <g fill={STROKE} fontFamily="var(--font-display)" fontWeight="700" opacity="0.5">
          <text x="150" y="55" fontSize="14">
            z
          </text>
          <text x="160" y="42" fontSize="11">
            z
          </text>
        </g>
      )}
    </svg>
  );
}
