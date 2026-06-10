'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCategoryAction,
  updateCategoryAction,
  archiveCategoryAction,
} from '@/src/actions/inventory';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  order: number;
  archivedAt: Date | null;
};

export default function CategoryManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const router = useRouter();
  const [categories] = useState(initialCategories);
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = await createCategoryAction({
      name: fd.get('name') as string,
      slug: fd.get('slug') as string,
      description: (fd.get('description') as string) || undefined,
      active: true,
      order: Number(fd.get('order') ?? 0),
    });
    if (result.ok) {
      setShowNew(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = await updateCategoryAction({
      id,
      name: fd.get('name') as string,
      slug: fd.get('slug') as string,
      description: (fd.get('description') as string) || undefined,
      order: Number(fd.get('order') ?? 0),
    });
    if (result.ok) {
      setEditing(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleArchive(id: string) {
    const result = await archiveCategoryAction(id);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  const active = categories.filter((c) => !c.archivedAt);
  const archived = categories.filter((c) => c.archivedAt);

  return (
    <div className="max-w-2xl space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {active.map((cat) =>
        editing === cat.id ? (
          <form
            key={cat.id}
            onSubmit={(e) => handleUpdate(cat.id, e)}
            className="border rounded-xl p-4 space-y-3 bg-blue-50"
          >
            <CategoryFields defaultValues={cat} />
            <div className="flex gap-2">
              <button type="submit" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg">
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-sm border px-4 py-1.5 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div key={cat.id} className="border rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{cat.name}</p>
              <p className="text-xs text-gray-400">/{cat.slug} · orden {cat.order}</p>
              {cat.description && <p className="text-sm text-gray-500 mt-1">{cat.description}</p>}
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={() => setEditing(cat.id)} className="text-blue-600 hover:underline">
                Editar
              </button>
              <button
                onClick={() => handleArchive(cat.id)}
                className="text-red-500 hover:underline"
              >
                Archivar
              </button>
            </div>
          </div>
        ),
      )}

      {showNew ? (
        <form
          onSubmit={handleCreate}
          className="border rounded-xl p-4 space-y-3 bg-green-50"
        >
          <p className="font-medium text-sm">Nueva categoría</p>
          <CategoryFields />
          <div className="flex gap-2">
            <button type="submit" className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg">
              Crear
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="text-sm border px-4 py-1.5 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-rose-300 hover:text-rose-500"
        >
          + Nueva categoría
        </button>
      )}

      {archived.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-gray-400 cursor-pointer">
            Archivadas ({archived.length})
          </summary>
          <div className="mt-2 space-y-2">
            {archived.map((cat) => (
              <div key={cat.id} className="border rounded-xl p-4 opacity-50">
                <p className="font-medium">{cat.name}</p>
                <p className="text-xs text-gray-400">/{cat.slug}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function CategoryFields({
  defaultValues,
}: {
  defaultValues?: { name: string; slug: string; description: string | null; order: number };
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
          <input
            name="name"
            defaultValue={defaultValues?.name}
            required
            className="w-full border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Slug</label>
          <input
            name="slug"
            defaultValue={defaultValues?.slug}
            required
            pattern="[a-z0-9-]+"
            className="w-full border rounded-lg px-3 py-1.5 text-sm font-mono"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
          <input
            name="description"
            defaultValue={defaultValues?.description ?? ''}
            className="w-full border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Orden</label>
          <input
            name="order"
            type="number"
            defaultValue={defaultValues?.order ?? 0}
            className="w-full border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>
    </>
  );
}
