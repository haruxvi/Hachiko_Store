'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCategoryAction,
  updateCategoryAction,
  archiveCategoryAction,
  restoreCategoryAction,
} from '@/src/actions/inventory';

export type PanelCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  archived: boolean;
  productCount: number;
};

// La lista viene de la página (ya buscada y paginada en el servidor) y se usa
// tal cual en cada render: tras crear, editar o archivar, router.refresh() trae
// la versión nueva y se ve al instante.
export default function CategoryManager({
  categories,
  emptyMessage,
  canCreate,
}: {
  categories: PanelCategory[];
  emptyMessage: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, onDone: () => void) {
    setError('');
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(
      () =>
        createCategoryAction({
          name: fd.get('name') as string,
          slug: fd.get('slug') as string,
          description: (fd.get('description') as string) || undefined,
          active: true,
          order: Number(fd.get('order') ?? 0),
        }),
      () => setShowNew(false),
    );
  }

  function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(
      () =>
        updateCategoryAction({
          id,
          name: fd.get('name') as string,
          slug: fd.get('slug') as string,
          description: (fd.get('description') as string) || undefined,
          order: Number(fd.get('order') ?? 0),
        }),
      () => setEditing(null),
    );
  }

  function handleArchive(cat: PanelCategory) {
    const warning =
      cat.productCount > 0
        ? `“${cat.name}” tiene ${cat.productCount} ${cat.productCount === 1 ? 'producto' : 'productos'}. Dejará de verse en la tienda. ¿Archivarla?`
        : `¿Archivar “${cat.name}”?`;
    if (!window.confirm(warning)) return;
    run(() => archiveCategoryAction(cat.id), () => undefined);
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-input border border-alert/30 bg-alert/[0.08] px-4 py-3 text-sm font-medium text-soot">
          {error}
        </p>
      )}

      {canCreate &&
        (showNew ? (
          <form method="post" onSubmit={handleCreate} className="card-hs space-y-4 p-5">
            <h2 className="font-display text-lg font-bold text-soot">Nueva categoría</h2>
            <CategoryFields idPrefix="new" />
            <FormButtons pending={pending} submitLabel="Crear categoría" onCancel={() => setShowNew(false)} />
          </form>
        ) : (
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowNew(true)} className="btn-primary btn-sm min-h-11">
              + Nueva categoría
            </button>
          </div>
        ))}

      <div className="overflow-hidden rounded-2xl border border-sand bg-snow">
        <div className="hidden grid-cols-[minmax(0,1fr)_90px_70px_150px] gap-4 bg-cream px-4 py-3 text-xs font-medium text-taupe sm:grid">
          <span>Categoría</span>
          <span className="text-right">Productos</span>
          <span className="text-right">Orden</span>
          <span className="sr-only">Acciones</span>
        </div>

        {categories.length === 0 && (
          <p className="px-4 py-10 text-center text-[15px] text-taupe-deep">{emptyMessage}</p>
        )}

        <ul>
          {categories.map((cat) => (
            <li key={cat.id} className="border-t border-sand first:border-t-0 sm:first:border-t">
              {editing === cat.id ? (
                <form method="post" onSubmit={(e) => handleUpdate(cat.id, e)} className="space-y-4 bg-cream/60 p-5">
                  <CategoryFields idPrefix={cat.id} defaultValues={cat} />
                  <FormButtons pending={pending} submitLabel="Guardar cambios" onCancel={() => setEditing(null)} />
                </form>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition hover:bg-cream/60 sm:grid-cols-[minmax(0,1fr)_90px_70px_150px]">
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium leading-snug text-soot">{cat.name}</div>
                    <div className="mt-0.5 truncate text-[13px] text-taupe-deep">
                      <span className="price-mono text-[12px]">/{cat.slug}</span>
                      {cat.description && <> · {cat.description}</>}
                    </div>
                  </div>
                  <div className="price-mono text-right text-[15px] text-soot">
                    {cat.productCount}
                    <span className="text-[12px] text-taupe-deep sm:hidden"> productos</span>
                  </div>
                  <div className="price-mono hidden text-right text-[15px] text-taupe-deep sm:block">{cat.order}</div>
                  <div className="col-span-2 flex items-center gap-4 text-[13px] font-medium sm:col-span-1 sm:justify-end">
                    {cat.archived ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => restoreCategoryAction(cat.id), () => undefined)}
                        className="text-soot underline decoration-mint-deep decoration-2 underline-offset-4 hover:decoration-soot disabled:opacity-50"
                      >
                        Restaurar
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setError('');
                            setEditing(cat.id);
                          }}
                          className="text-soot underline decoration-rust decoration-2 underline-offset-4 hover:decoration-soot"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleArchive(cat)}
                          className="text-alert transition hover:underline disabled:opacity-50"
                        >
                          Archivar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FormButtons({
  pending,
  submitLabel,
  onCancel,
}: {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={pending} className="btn-primary btn-sm min-h-11 disabled:opacity-60">
        {pending ? 'Guardando…' : submitLabel}
      </button>
      <button type="button" onClick={onCancel} className="btn-ghost btn-sm min-h-11">
        Cancelar
      </button>
    </div>
  );
}

function CategoryFields({
  idPrefix,
  defaultValues,
}: {
  idPrefix: string;
  defaultValues?: { name: string; slug: string; description: string | null; order: number };
}) {
  const id = (f: string) => `cat-${idPrefix}-${f}`;
  const label = 'mb-1.5 block text-xs font-medium text-taupe-deep';
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <label htmlFor={id('name')} className={label}>
          Nombre
        </label>
        <input id={id('name')} name="name" defaultValue={defaultValues?.name} required className="input-hs !py-2" />
      </div>
      <div className="sm:col-span-3">
        <label htmlFor={id('slug')} className={label}>
          Slug (en la dirección web)
        </label>
        <input
          id={id('slug')}
          name="slug"
          defaultValue={defaultValues?.slug}
          required
          pattern="[a-z0-9-]+"
          title="Solo minúsculas, números y guiones"
          className="input-hs price-mono !py-2 !text-[14px]"
        />
      </div>
      <div className="sm:col-span-4">
        <label htmlFor={id('description')} className={label}>
          Descripción
        </label>
        <input
          id={id('description')}
          name="description"
          defaultValue={defaultValues?.description ?? ''}
          className="input-hs !py-2"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={id('order')} className={label}>
          Orden
        </label>
        <input
          id={id('order')}
          name="order"
          type="number"
          defaultValue={defaultValues?.order ?? 0}
          className="input-hs price-mono !py-2"
        />
      </div>
    </div>
  );
}
