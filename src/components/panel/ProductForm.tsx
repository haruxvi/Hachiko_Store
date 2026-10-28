'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProductAction, updateProductAction } from '@/src/actions/inventory';
import { safeImageUrl } from '@/src/lib/image-url';

type Category = { id: string; name: string };

type ProductFormProps = {
  categories: Category[];
  initial?: {
    id: string;
    sku: string;
    slug: string;
    name: string;
    nameKorean?: string | null;
    description: string;
    priceCLP: number;
    costCLP?: number | null;
    stock: number;
    lowStockThreshold: number;
    weightGrams: number;
    images: string[];
    active: boolean;
    featured: boolean;
    categoryId: string;
    category?: { name: string; slug?: string };
  };
};

const UPLOAD_ERRORS: Record<string, string> = {
  FORBIDDEN: 'Tu sesión no tiene permiso para subir fotos.',
  RATE_LIMITED: 'Demasiadas subidas seguidas. Espera unos segundos.',
  STORAGE_NOT_CONFIGURED: 'Falta configurar el almacenamiento (BLOB_READ_WRITE_TOKEN).',
  INVALID_TYPE: 'Formato no válido. Usa JPG, PNG, WEBP, AVIF o GIF.',
  TOO_LARGE: 'La imagen supera los 4 MB. Súbela más liviana.',
  NO_FILE: 'No se recibió ningún archivo.',
};

export default function ProductForm({ categories, initial }: ProductFormProps) {
  const router = useRouter();
  const isEdit = !!initial;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Las imágenes ahora se manejan como estado (miniaturas + subida), no como
  // textarea de URLs. Se envían desde aquí en el submit.
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/trastienda/upload', { method: 'POST', body: fd });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(UPLOAD_ERRORS[json?.error?.code] ?? 'No se pudo subir la imagen.');
          break;
        }
        setImages((prev) => [...prev, json.url as string]);
      }
    } catch {
      setError('No se pudo subir la imagen. Revisa tu conexión.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function addUrl() {
    if (!urlDraft.trim()) return;
    // Lo que se pega se valida antes de usarlo como src de una imagen.
    const url = safeImageUrl(urlDraft);
    if (!url) {
      setError('La URL de la imagen debe empezar con https://');
      return;
    }
    setError('');
    setImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setUrlDraft('');
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);

    const data = {
      sku: fd.get('sku') as string,
      name: fd.get('name') as string,
      nameKorean: (fd.get('nameKorean') as string) || undefined,
      description: fd.get('description') as string,
      priceCLP: Number(fd.get('priceCLP')),
      costCLP: fd.get('costCLP') ? Number(fd.get('costCLP')) : undefined,
      stock: Number(fd.get('stock')),
      lowStockThreshold: Number(fd.get('lowStockThreshold')),
      weightGrams: Number(fd.get('weightGrams')),
      images,
      active: fd.get('active') === 'true',
      featured: fd.get('featured') === 'on',
      categoryId: fd.get('categoryId') as string,
    };

    let result;
    if (isEdit && initial) {
      result = await updateProductAction({ id: initial.id, ...data });
    } else {
      result = await createProductAction(data);
    }

    if (result.ok) {
      router.push('/trastienda/productos');
      router.refresh();
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  const v = initial;

  return (
    <form method="post" onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {error && (
        <div className="rounded-input border border-rust/30 bg-rust/[0.08] px-4 py-3 text-sm text-rust-ink">
          {error}
        </div>
      )}

      <Field label="SKU" name="sku" defaultValue={v?.sku} required />

      <Field label="Nombre" name="name" defaultValue={v?.name} required />
      <Field label="Nombre coreano" name="nameKorean" defaultValue={v?.nameKorean ?? ''} />

      <div>
        <Label>Descripción</Label>
        <textarea name="description" defaultValue={v?.description} rows={4} required className="input-hs" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Precio (CLP)" name="priceCLP" type="number" defaultValue={v?.priceCLP} required />
        <Field label="Costo (CLP)" name="costCLP" type="number" defaultValue={v?.costCLP ?? ''} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Stock inicial" name="stock" type="number" defaultValue={v?.stock ?? 0} required />
        <Field label="Umbral bajo stock" name="lowStockThreshold" type="number" defaultValue={v?.lowStockThreshold ?? 5} required />
        <Field label="Peso (gramos)" name="weightGrams" type="number" defaultValue={v?.weightGrams} required />
      </div>

      <div>
        <Label>Categoría</Label>
        <select name="categoryId" defaultValue={v?.categoryId} required className="input-hs">
          <option value="">Seleccionar...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* ──────── IMÁGENES ──────── */}
      <div>
        <Label>Fotos del producto</Label>

        <div className="mt-1 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((src, i) => (
            <div key={`${src}-${i}`} className="group relative aspect-square overflow-hidden rounded-input border border-sand bg-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={safeImageUrl(src) ?? undefined} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-chip bg-soot/80 px-1.5 py-0.5 text-[10px] font-medium text-snow">
                  Principal
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={`Quitar foto ${i + 1}`}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-snow/90 text-soot opacity-0 shadow-soft transition group-hover:opacity-100 hover:bg-snow"
              >
                ×
              </button>
            </div>
          ))}

          {/* Tile de subida */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-input border border-dashed border-taupe/50 bg-cream/40 text-taupe transition hover:border-rust hover:text-rust-ink disabled:opacity-60"
          >
            {uploading ? (
              <span className="text-xs font-medium">Subiendo…</span>
            ) : (
              <>
                <span className="text-2xl leading-none">+</span>
                <span className="text-xs font-medium">Subir foto</span>
              </>
            )}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          onChange={(e) => uploadFiles(e.target.files)}
          className="hidden"
        />

        <p className="mt-2 text-xs text-taupe">
          La primera foto es la principal. JPG, PNG, WEBP, AVIF o GIF · hasta 4 MB.
        </p>

        {/* Alternativa: pegar una URL */}
        <div className="mt-3 flex gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="…o pega la URL de una imagen"
            className="input-hs flex-1"
          />
          <button type="button" onClick={addUrl} className="btn-outline btn-sm shrink-0">
            Agregar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Estado</Label>
          <select name="active" defaultValue={v?.active !== false ? 'true' : 'false'} className="input-hs">
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
        <div className="flex items-end pb-3">
          <label className="flex items-center gap-2 text-sm text-soot">
            <input type="checkbox" name="featured" defaultChecked={v?.featured} className="h-4 w-4 accent-rust" />
            Destacado
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading || uploading} className="btn-primary disabled:opacity-50">
          {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-outline">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-taupe">{children}</label>;
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} name={name} defaultValue={defaultValue ?? ''} required={required} className="input-hs" />
    </div>
  );
}
