import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '@/src/app/manifest';

// ─── Manifiesto ──────────────────────────────────────────────────────────────

const PUBLIC = join(process.cwd(), 'public');

function pngSize(path: string) {
  const b = readFileSync(path);
  // Firma PNG + cabecera IHDR: ancho y alto en los bytes 16–23.
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

describe('manifiesto de la PWA', () => {
  const m = manifest();

  it('cumple los requisitos de instalación (standalone, nombre, start_url dentro del scope)', () => {
    expect(m.display).toBe('standalone');
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url?.startsWith(m.scope ?? '/')).toBe(true);
  });

  it('declara íconos de 192 y 512 px y uno "maskable"', () => {
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect((m.icons ?? []).some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('cada ícono declarado existe y mide lo que dice', () => {
    for (const icon of m.icons ?? []) {
      const file = join(PUBLIC, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      expect(pngSize(file), icon.src).toBe(icon.sizes);
    }
    expect(pngSize(join(PUBLIC, 'icons/apple-touch-icon.png'))).toBe('180x180');
  });

  it('los accesos directos apuntan a rutas internas', () => {
    for (const s of m.shortcuts ?? []) expect(s.url.startsWith('/')).toBe(true);
  });
});

// ─── Service worker ──────────────────────────────────────────────────────────
// Se ejecuta el public/sw.js real con `self`, `caches` y `fetch` simulados.

const ORIGIN = 'https://hachiko.test';
const SW = readFileSync(join(PUBLIC, 'sw.js'), 'utf8');

type Req = { url: string; method: string; mode: string };
type Handler = (event: Record<string, unknown>) => void;

function setup() {
  const handlers: Record<string, Handler> = {};
  const store = new Map<string, Map<string, Response>>();
  const fetched: string[] = [];
  const net = { online: true, status: 200 };
  const keyOf = (r: string | Req) => (typeof r === 'string' ? new URL(r, ORIGIN).href : r.url);

  const openCache = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name)!;
    return {
      addAll: async (urls: string[]) => urls.forEach((u) => m.set(keyOf(u), new Response(`precache:${u}`))),
      put: async (req: Req, res: Response) => void m.set(keyOf(req), res),
      match: async (req: Req) => m.get(keyOf(req)),
      keys: async () => [...m.keys()].map((url) => ({ url, method: 'GET', mode: 'cors' })),
      delete: async (req: Req) => m.delete(keyOf(req)),
    };
  };
  const caches = {
    open: async (name: string) => openCache(name),
    match: async (req: string | Req) => {
      for (const m of store.values()) {
        const hit = m.get(keyOf(req));
        if (hit) return hit;
      }
      return undefined;
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
  };
  const fetchMock = async (req: Req) => {
    fetched.push(keyOf(req));
    if (!net.online) throw new TypeError('Failed to fetch');
    return new Response(`red:${keyOf(req)}`, { status: net.status });
  };
  const self = {
    addEventListener: (type: string, fn: Handler) => void (handlers[type] = fn),
    location: { origin: ORIGIN },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  new Function('self', 'caches', 'fetch', SW)(self, caches, fetchMock);

  async function dispatch(type: string, extra: Record<string, unknown> = {}) {
    const pending: Promise<unknown>[] = [];
    let responded: Promise<Response | undefined> | undefined;
    handlers[type]!({
      ...extra,
      respondWith: (p: Promise<Response>) => void (responded = Promise.resolve(p)),
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
    });
    const res = responded ? await responded : undefined;
    // Las tareas en segundo plano (guardar en caché) pueden encolarse al resolver.
    while (pending.length) await Promise.all(pending.splice(0));
    return { intercepted: responded !== undefined, res };
  }

  const req = (path: string, o: { method?: string; mode?: string; origin?: string } = {}): Req => ({
    url: new URL(path, o.origin ?? ORIGIN).href,
    method: o.method ?? 'GET',
    mode: o.mode ?? 'cors',
  });
  const cachedUrls = () => [...store.values()].flatMap((m) => [...m.keys()]);

  return { dispatch, req, store, fetched, net, cachedUrls };
}

describe('service worker', () => {
  it('al instalarse guarda solo la página offline y los íconos', async () => {
    const sw = setup();
    await sw.dispatch('install');
    expect(sw.cachedUrls().map((u) => new URL(u).pathname).sort()).toEqual(
      ['/icons/icon-192.png', '/icons/icon-512.png', '/offline'].sort(),
    );
  });

  it('al activarse borra versiones viejas propias, sin tocar cachés ajenas', async () => {
    const sw = setup();
    sw.store.set('hachiko-static-v0', new Map());
    sw.store.set('otra-app', new Map());
    await sw.dispatch('install');
    await sw.dispatch('activate');
    const names = [...sw.store.keys()];
    expect(names).not.toContain('hachiko-static-v0');
    expect(names).toContain('otra-app');
    expect(names.some((n) => n.startsWith('hachiko-shell-'))).toBe(true);
  });

  it.each([
    ['POST de login', '/api/auth/login', { method: 'POST' }],
    ['GET de la API (datos personales)', '/api/me/data-export', {}],
    ['otro origen (pago)', '/webpay', { origin: 'https://webpay3g.transbank.cl' }],
    ['datos de React (RSC)', '/perfil?_rsc=1', {}],
  ])('no intercepta: %s', async (_, path, opts) => {
    const sw = setup();
    const { intercepted } = await sw.dispatch('fetch', { request: sw.req(path, opts) });
    expect(intercepted).toBe(false);
  });

  it.each(['/perfil', '/pedidos', '/trastienda', '/checkout', '/datos'])(
    'la página %s viene de la red y NUNCA se guarda en el dispositivo',
    async (path) => {
      const sw = setup();
      await sw.dispatch('install');
      const { res } = await sw.dispatch('fetch', { request: sw.req(path, { mode: 'navigate' }) });
      expect(await res!.text()).toBe(`red:${ORIGIN}${path}`);
      expect(sw.cachedUrls()).not.toContain(`${ORIGIN}${path}`);
    },
  );

  it('sin conexión, cualquier página muestra /offline', async () => {
    const sw = setup();
    await sw.dispatch('install');
    sw.net.online = false;
    const { res } = await sw.dispatch('fetch', { request: sw.req('/catalogo', { mode: 'navigate' }) });
    expect(await res!.text()).toBe('precache:/offline');
  });

  it('los archivos estáticos se bajan una vez y luego salen de la caché', async () => {
    const sw = setup();
    const asset = sw.req('/_next/static/chunks/app-abc123.js');
    const first = await sw.dispatch('fetch', { request: asset });
    expect(await first.res!.text()).toBe(`red:${asset.url}`);
    const second = await sw.dispatch('fetch', { request: asset });
    expect(await second.res!.text()).toBe(`red:${asset.url}`);
    expect(sw.fetched.filter((u) => u === asset.url)).toHaveLength(1);
  });

  it('no guarda respuestas de error', async () => {
    const sw = setup();
    sw.net.status = 404;
    await sw.dispatch('fetch', { request: sw.req('/_next/static/chunks/no-existe.js') });
    expect(sw.cachedUrls()).toHaveLength(0);
  });

  it('el tope de archivos nunca borra la página /offline', async () => {
    const sw = setup();
    await sw.dispatch('install');
    for (let i = 0; i < 200; i++) {
      await sw.dispatch('fetch', { request: sw.req(`/_next/static/chunks/c${i}.js`) });
    }
    const assets = [...sw.store.entries()].find(([name]) => name.startsWith('hachiko-assets-'))![1];
    expect(assets.size).toBeLessThanOrEqual(150);
    expect(assets.has(`${ORIGIN}/_next/static/chunks/c199.js`)).toBe(true); // se conservan los más nuevos
    sw.net.online = false;
    const { res } = await sw.dispatch('fetch', { request: sw.req('/', { mode: 'navigate' }) });
    expect(await res!.text()).toBe('precache:/offline');
  });
});
