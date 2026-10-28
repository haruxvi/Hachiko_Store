import Link from "next/link";
import { getSession } from "@/src/lib/auth/session";
import { db } from "@/src/lib/db";
import ProductCsvImport from "@/src/components/panel/ProductCsvImport";

export default async function ImportarProductosPage() {
  const session = await getSession();
  if (!session || session.role !== "SELLER") return null;
  const categories = await db.category.findMany({
    where: { active: true, archivedAt: null },
    select: { id: true, name: true, slug: true },
    orderBy: { order: "asc" },
  });
  return (
    <div className="max-w-5xl space-y-6">
      <Link
        href="/trastienda/productos"
        className="text-sm text-taupe hover:text-rust-ink"
      >
        ← Volver a productos
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-soot">
          Carga masiva de productos
        </h1>
        <p className="mt-2 text-sm text-taupe">
          Sube un CSV o un Excel (.xlsx), valida sus productos y revisa la vista
          previa antes de guardarlos en la tienda.
        </p>
      </div>
      <ProductCsvImport categories={categories} />
    </div>
  );
}
