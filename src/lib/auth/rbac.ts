import { NextResponse } from 'next/server';
import type { Role } from '@prisma/client';
import type { JWTPayload } from './jwt';

export function requireRole(
  payload: JWTPayload | null,
  allowedRoles: Role[]
): NextResponse | null {
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }
  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }
  return null;
}

export function canAccessPII(role: Role): boolean {
  return role === 'ADMIN';
}

export function canManageCatalog(role: Role): boolean {
  return role === 'SELLER' || role === 'ADMIN';
}

export function canViewOrders(role: Role): boolean {
  return role === 'SELLER' || role === 'ADMIN';
}

export function canRefund(role: Role): boolean {
  return role === 'ADMIN';
}
