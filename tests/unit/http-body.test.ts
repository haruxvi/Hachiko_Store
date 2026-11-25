import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { readJsonBody } from '@/src/lib/http-body';

// readJsonBody solo usa headers.get() y text(); un Request estándar basta.
// Por defecto como lo envía el front (fetch con Content-Type: application/json).
function req(body: string, headers: Record<string, string> = {}): NextRequest {
  return new Request('http://localhost/x', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  }) as unknown as NextRequest;
}

describe('readJsonBody (anti login CSRF)', () => {
  it('un <form enctype="text/plain"> de otro sitio no pasa aunque el cuerpo sea JSON válido → 415', async () => {
    const r = await readJsonBody(req('{"email":"a@b.cl","password":"x","x":"="}', { 'content-type': 'text/plain' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(415);
  });

  it('sin Content-Type tampoco → 415', async () => {
    const r = await readJsonBody(req('{}', { 'content-type': '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(415);
  });

  it('el navegador la marca como de otro sitio → 403', async () => {
    const r = await readJsonBody(req('{}', { 'sec-fetch-site': 'cross-site' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it('acepta JSON con charset y desde el mismo sitio', async () => {
    const r = await readJsonBody(
      req('{"a":1}', { 'content-type': 'application/json; charset=utf-8', 'sec-fetch-site': 'same-origin' }),
    );
    expect(r).toEqual({ ok: true, data: { a: 1 } });
  });
});

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
