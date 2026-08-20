'use client';

// Botón para imprimir / exportar a PDF el reporte (usa el diálogo del
// navegador). Se oculta al imprimir con la clase 'no-print'.
export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-outline btn-sm no-print">
      Imprimir / PDF
    </button>
  );
}
