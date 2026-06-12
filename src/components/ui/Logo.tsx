// Marca Hachiko — huella de pata sugerida con 4 puntos en un círculo, mínima.
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" stroke="#3D2F25" strokeWidth="1.5" />
      <ellipse cx="11" cy="13" rx="2" ry="2.5" fill="#3D2F25" />
      <ellipse cx="21" cy="13" rx="2" ry="2.5" fill="#3D2F25" />
      <ellipse cx="13" cy="19" rx="1.6" ry="2" fill="#3D2F25" />
      <ellipse cx="19" cy="19" rx="1.6" ry="2" fill="#3D2F25" />
      <ellipse cx="16" cy="22" rx="3" ry="2.4" fill="#3D2F25" />
    </svg>
  );
}
