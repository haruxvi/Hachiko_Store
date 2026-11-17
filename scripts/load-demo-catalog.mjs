import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const catalog = JSON.parse(readFileSync(new URL('../prisma/catalogo-demo.json', import.meta.url), 'utf8'));
const images = catalog.products.flatMap((product) => product.images);
if (images.some((url) => !(url.startsWith('https://') || url.startsWith('/')))) {
  throw new Error('El catálogo contiene una URL de imagen no válida.');
}
console.log(`Catálogo: ${catalog.categories.length} categorías, ${catalog.products.length} productos, ${images.length} imágenes.`);
if (!process.argv.includes('--apply')) {
  console.log('Solo comprobación. Usa --apply para cargar los productos en la base indicada por .env.');
  process.exit(0);
}

process.loadEnvFile('.env');
const db = new PrismaClient();
let created = 0;
let updatedImages = 0;
let existing = 0;
try {
  const categoryIds = new Map();
  for (const category of catalog.categories) {
    const saved = await db.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
    categoryIds.set(category.slug, saved.id);
  }
  for (const product of catalog.products) {
    const { categorySlug, ...fields } = product;
    const categoryId = categoryIds.get(categorySlug);
    if (!categoryId) throw new Error(`Falta la categoría ${categorySlug} para ${product.sku}.`);
    const saved = await db.product.findUnique({ where: { sku: fields.sku }, select: { id: true, images: true } });
    if (saved) {
      if (saved.images.length === 0 && fields.images.length > 0) {
        await db.product.update({ where: { id: saved.id }, data: { images: fields.images } });
        updatedImages++;
      } else existing++;
      continue;
    }
    await db.$transaction(async (tx) => {
      const added = await tx.product.create({ data: { ...fields, categoryId } });
      if (fields.stock > 0) {
        await tx.stockMovement.create({ data: {
          productId: added.id,
          type: 'IN',
          reason: 'INITIAL_LOAD',
          quantity: fields.stock,
          previousStock: 0,
          resultingStock: fields.stock,
          notes: 'Carga inicial del catálogo de demostración',
        } });
      }
    });
    created++;
  }
  console.log(`Cargados: ${created} nuevos, ${updatedImages} con imágenes añadidas, ${existing} existentes sin cambios.`);
} finally {
  await db.$disconnect();
}
