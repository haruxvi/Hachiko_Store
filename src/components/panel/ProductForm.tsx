'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProductAction, updateProductAction } from '@/src/actions/inventory';

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

export default function ProductForm({ categories, initial }: ProductFormProps) {
  const router = useRouter();
  const isEdit = !!initial;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);

    const data = {
      sku: fd.get('sku') as string,
      slug: fd.get('slug') as string,
      name: fd.get('name') as string,
      nameKorean: (fd.get('nameKorean') as string) || undefined,
      description: fd.get('description') as string,
      priceCLP: Number(fd.get('priceCLP')),
      costCLP: fd.get('costCLP') ? Number(fd.get('costCLP')) : undefined,
      stock: Number(fd.get('stock')),
      lowStockThreshold: Number(fd.get('lowStockThreshold')),
      weightGrams: Number(fd.get('weightGrams')),
      images: (fd.get('images') as string)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
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
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU" name="sku" defaultValue={v?.sku} required />
        <Field label="Slug (URL)" name="slug" defaultValue={v?.slug} required />
      </div>

      <Field label="Nombre" name="name" defaultValue={v?.name} required />
      <Field label="Nombre coreano" name="nameKorean" defaultValue={v?.nameKorean ?? ''} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          name="description"
          defaultValue={v?.description}
          rows={4}
          required
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
        <select
          name="categoryId"
          defaultValue={v?.categoryId}
          required
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        >
          <option value="">Seleccionar...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Imágenes (una URL por línea)
        </label>
        <textarea
          name="images"
          defaultValue={v?.images.join('\n') ?? ''}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            name="active"
            defaultValue={v?.active !== false ? 'true' : 'false'}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={v?.featured}
              className="w-4 h-4"
            />
            Destacado
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-rose-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-rose-700 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
      />
    </div>
  );
}
