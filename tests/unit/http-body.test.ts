import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { readJsonBody } from '@/src/lib/http-body';

// readJsonBody solo usa headers.get() y text(); un Request estándar basta.
function req(body: string, headers: Record<string, string> = {}): NextRequest {
  return new Request('http://localhost/x', { method: 'POST', body, headers }) as unknown as NextRequest;
}

describe('readJsonBody (tope de tamaño anti-DoS)', () => {
  it('parsea un cuerpo JSON válido dentro del tope', async () => {
    const r = await readJsonBody(req('{"a":1}'));
    expect(r).toEqual({ ok: true, data: { a: 1 } });
  });

  it('cuerpo vacío → objeto vacío', async () => {
    const r = await readJsonBody(req(''));
    expect(r).toEqual({ ok: true, data: {} });
  });

  it('rechaza por Content-Length declarado mayor al tope → 413', async () => {
    const r = await readJsonBody(req('{}', { 'content-length': String(32 * 1024) }), 16 * 1024);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });

  it('rechaza por tamaño real aunque el Content-Length mienta → 413', async () => {
    const big = '"' + 'a'.repeat(20 * 1024) + '"';
    const r = await readJsonBody(req(big, { 'content-length': '5' }), 16 * 1024);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });

  it('JSON inválido → 400, sin lanzar', async () => {
    const r = await readJsonBody(req('{roto'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });
});
