import { NextResponse } from 'next/server';
import { openApiSpec } from '@/src/lib/docs/openapi';

// Especificación OpenAPI en JSON — SOLO en desarrollo (mismo criterio que /api/docs).
export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  return NextResponse.json(openApiSpec, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
