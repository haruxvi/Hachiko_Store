import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  // Categories
  const categories = await Promise.all([
    db.category.upsert({
      where: { slug: 'snacks' },
      update: {},
      create: { name: 'Snacks', slug: 'snacks', description: 'Golosinas y snacks coreanos', order: 1 },
    }),
    db.category.upsert({
      where: { slug: 'skincare' },
      update: {},
      create: { name: 'Skincare', slug: 'skincare', description: 'Cuidado de piel coreano', order: 2 },
    }),
    db.category.upsert({
      where: { slug: 'papeleria' },
      update: {},
      create: { name: 'Papelería', slug: 'papeleria', description: 'Papelería y accesorios coreanos', order: 3 },
    }),
    db.category.upsert({
      where: { slug: 'kpop' },
      update: {},
      create: { name: 'K-pop', slug: 'kpop', description: 'Merch y álbumes K-pop', order: 4 },
    }),
  ]);

  console.log(`Seeded ${categories.length} categories`);

  // Sample product
  const snacks = categories.find((c) => c.slug === 'snacks')!;
  await db.product.upsert({
    where: { sku: 'SNACK-001' },
    update: {},
    create: {
      sku: 'SNACK-001',
      slug: 'pepero-chocolate-original',
      name: 'Pepero Chocolate Original',
      nameKorean: '빼빼로 초콜릿',
      description: 'El clásico snack de palitos de galleta bañados en chocolate Lotte. 50g.',
      priceCLP: 1990,
      stock: 100,
      weightGrams: 60,
      images: [],
      featured: true,
      categoryId: snacks.id,
    },
  });

  console.log('Seed complete');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
