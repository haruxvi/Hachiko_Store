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

  await seedTestUsers();

  console.log('Seed complete');
}

// Usuarios de prueba: SOLO se crean si las credenciales llegan por variables
// de entorno (SEED_SELLER_EMAIL/PASSWORD, SEED_CLIENT_EMAIL/PASSWORD).
// Nunca se hardcodean credenciales en el código, ni siquiera de prueba.
// En la entrega al cliente estas variables no se configuran y no se crea nada.
async function seedTestUsers() {
  const candidates = [
    {
      email: process.env['SEED_SELLER_EMAIL'],
      password: process.env['SEED_SELLER_PASSWORD'],
      role: 'SELLER' as const,
      firstName: 'Vendedor',
    },
    {
      email: process.env['SEED_CLIENT_EMAIL'],
      password: process.env['SEED_CLIENT_PASSWORD'],
      role: 'CLIENT' as const,
      firstName: 'Cliente',
    },
  ];

  const argon2 = await import('argon2');

  for (const u of candidates) {
    if (!u.email || !u.password) continue;

    const passwordHash = await argon2.hash(u.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await db.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: {
        email: u.email,
        passwordHash,
        role: u.role,
        firstName: u.firstName,
        lastName: 'De Prueba',
        consentEssential: true,
        consentMarketing: false,
        consentVersion: 'v1.0-2026',
        consentAt: new Date(),
      },
    });
    console.log(`Seeded ${u.role} de prueba: ${u.email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
