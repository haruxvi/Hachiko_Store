import { NextResponse } from 'next/server';
import type { Role } from '@prisma/client';
import type { JWTPayload } from './jwt';

export function requireRole(
  payload: JWTPayload | null,
  allowedRoles: Role[]
): NextResponse | null {
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 }
    );
  }
  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Sin permisos' } },
      { status: 403 }
    );
  }
  return null;
}

// El SELLER gestiona catálogo y despacha — el CLIENT compra
export function canManageCatalog(role: Role): boolean {
  return role === 'SELLER';
}

export function canDispatchOrders(role: Role): boolean {
  return role === 'SELLER';
}
