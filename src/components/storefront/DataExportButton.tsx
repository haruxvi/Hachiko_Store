'use client';

import { useState } from 'react';

export default function DataExportButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    const res = await fetch('/api/me/data-export');
    const json = await res.json() as { ok: boolean; data?: unknown };
    setLoading(false);
    if (json.ok) {
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hachiko-mis-datos-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="text-sm bg-gray-900 text-white font-medium px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
    >
      {loading ? 'Generando…' : 'Descargar mis datos'}
    </button>
  );
}
