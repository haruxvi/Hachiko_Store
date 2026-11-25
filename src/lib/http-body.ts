import { NextResponse, type NextRequest } from 'next/server';

// Lectura de cuerpos JSON con TOPE de tamaño para los route handlers de la web
// (/api/auth/*, pagos, cuenta). Sin esto, `await request.json()` buffea en
// memoria todo lo que mande el cliente: un cuerpo de decenas de MB a un
// endpoint sin autenticar (login, registro) es un vector de agotamiento de
// memoria. La API v1 ya tenía su propio tope (src/lib/api/v1.ts); esto lo lleva
// a la web. 16 KB sobra para cualquier formulario real.
const DEFAULT_MAX_BYTES = 16 * 1024;

export type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; response: NextResponse };

function tooLarge(): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code: 'TOO_LARGE', message: 'La solicitud es demasiado grande.' } },
    { status: 413 },
  );
}

/**
 * Anti-CSRF de los route handlers con cookies (login, pagos, cuenta). Un
 * `<form enctype="text/plain">` en otro sitio puede armar un cuerpo que es JSON
 * válido y enviarlo con navegación de nivel superior: el navegador acepta las
 * cookies de la respuesta (login CSRF: la víctima queda dentro de la cuenta del
 * atacante y lo que compre, con su dirección, lo ve el atacante). Un formulario
 * no puede enviar `application/json`, y un fetch de otro origen con ese tipo
 * exige preflight CORS, que este sitio no autoriza. Además se rechaza lo que el
 * navegador marca como `Sec-Fetch-Site: cross-site`.
 */
function crossSiteRejection(req: NextRequest): NextResponse | null {
  if (req.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Solicitud no permitida.' } },
      { status: 403 },
    );
  }
  const type = (req.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (type !== 'application/json') {
    return NextResponse.json(
      { ok: false, error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Envía la solicitud como JSON.' } },
      { status: 415 },
    );
  }
  return null;
}

/**
 * Lee y parsea el cuerpo JSON sin pasar de `maxBytes`. Rechaza por
 * Content-Length (barato) y, como respaldo, por el largo real del texto (un
 * cliente puede mentir u omitir el header). Exige `Content-Type:
 * application/json` y descarta solicitudes de otro sitio (ver arriba). Nunca
 * lanza: devuelve una respuesta lista para retornar.
 */
export async function readJsonBody(req: NextRequest, maxBytes = DEFAULT_MAX_BYTES): Promise<JsonBodyResult> {
  const rejected = crossSiteRejection(req);
  if (rejected) return { ok: false, response: rejected };
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, response: tooLarge() };

  const text = await req.text();
  if (text.length > maxBytes) return { ok: false, response: tooLarge() };

  try {
    return { ok: true, data: text ? JSON.parse(text) : {} };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: { code: 'VALIDATION', message: 'Solicitud inválida.' } },
        { status: 400 },
      ),
    };
  }
}
