import type { PrismaClient } from '@prisma/client';

// La tienda opera con un número fijo y pequeño de vendedores. Limitar cuántas
// cuentas SELLER pueden existir reduce la superficie de abuso: aunque alguien
// lograra crear/promover una cuenta, no puede multiplicar el acceso al panel.
export const MAX_SELLERS = 2;

export class SellerLimitError extends Error {
  constructor() {
    super(`No se permiten más de ${MAX_SELLERS} vendedores (SELLER).`);
    this.name = 'SellerLimitError';
  }
}

// Lanza SellerLimitError si crear/promover a SELLER el email dado superaría el
// tope. Si el email YA es SELLER, no cuenta como cupo nuevo (idempotente).
// Acepta cualquier cliente Prisma (app o seed) para poder usarse en ambos.
export async function assertSellerSlotAvailable(
  prisma: Pick<PrismaClient, 'user'>,
  email: string
): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });
  if (existing?.role === 'SELLER') return; // ya ocupa un cupo, no suma

  const sellerCount = await prisma.user.count({ where: { role: 'SELLER' } });
  if (sellerCount >= MAX_SELLERS) {
    throw new SellerLimitError();
  }
}
