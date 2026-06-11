import { NextResponse } from 'next/server';

// Swagger UI — SOLO en desarrollo. En producción la ruta no existe (404):
// la documentación interactiva no debe exponer la superficie de ataque.
// El CSP global excluye /api/docs en dev (ver next.config.ts); aquí se
// define uno propio que permite los assets de swagger-ui desde unpkg.

const SWAGGER_UI_VERSION = '5.18.2';

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hachiko API — Swagger UI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/docs/spec',
        dom_id: '#swagger-ui',
        deepLinking: true,
        defaultModelsExpandDepth: 0,
      });
    </script>
  </body>
</html>`;

export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': [
        "default-src 'none'",
        "script-src 'unsafe-inline' https://unpkg.com",
        "style-src 'unsafe-inline' https://unpkg.com",
        "img-src 'self' data: https://unpkg.com",
        "font-src 'self'",
        "connect-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    },
  });
}
