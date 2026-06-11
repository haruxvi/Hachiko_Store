// Especificación OpenAPI 3.1 de la API de Hachiko — fuente única de verdad.
// La consumen:
//   - GET /api/docs        → Swagger UI (solo en desarrollo)
//   - GET /api/docs/spec   → JSON crudo (solo en desarrollo)
//   - pnpm docs:api        → exporta docs/api/openapi.json para revisión humana
//
// Si agregas o cambias una ruta en src/app/api/**, actualiza este archivo en
// el mismo commit (regla de la Definition of Done — ver docs/plan-sqa-ieee730.md).

const ErrorResponse = {
  type: 'object',
  required: ['ok', 'error'],
  properties: {
    ok: { type: 'boolean', const: false },
    error: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string', description: 'Código estable para manejo programático' },
        message: { type: 'string', description: 'Mensaje legible en español' },
      },
    },
  },
} as const;

const okOnly = {
  type: 'object',
  required: ['ok'],
  properties: { ok: { type: 'boolean', const: true } },
} as const;

function errorContent(description: string) {
  return {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  };
}

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Hachiko API',
    version: '0.1.0',
    description:
      'API del e-commerce Hachiko. Autenticación por cookies httpOnly (JWT firmado HS256): ' +
      '`hachiko_access` (15 min) y `hachiko_refresh` (7 días, scope `/api/auth/refresh`). ' +
      'Todas las respuestas de error siguen el formato `{ ok: false, error: { code, message } }`.',
    contact: { email: 'contacto@hachiko.cl' },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Desarrollo local' },
    { url: 'https://hachiko.cl', description: 'Producción' },
  ],
  tags: [
    { name: 'Auth', description: 'Registro, login, refresco y cierre de sesión' },
    { name: 'Cuenta', description: 'Derechos ARCO: exportación y eliminación de datos (Ley 21.719)' },
    { name: 'Pagos', description: 'Webpay Plus (Transbank) y Mercado Pago Checkout Pro' },
    { name: 'Seguridad', description: 'Exportación de informes de incidencias (Ley 21.663 / 21.459)' },
    { name: 'Cron', description: 'Tareas programadas de Vercel — requieren CRON_SECRET' },
    { name: 'Sistema', description: 'Salud y observabilidad' },
  ],
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar un cliente',
        description:
          'Crea la cuenta, registra el consentimiento (Ley 21.719) y deja la sesión iniciada ' +
          'vía cookies. Rate limit: 5 registros por IP por minuto.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } },
          },
        },
        responses: {
          '200': {
            description: 'Cuenta creada; cookies de sesión establecidas',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthOk' } } },
          },
          '400': errorContent('Datos inválidos (code: VALIDATION)'),
          '409': errorContent('El email ya está registrado (code: EMAIL_EXISTS)'),
          '429': errorContent('Demasiados intentos (code: RATE_LIMITED, header Retry-After)'),
          '500': errorContent('Error interno (code: INTERNAL)'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        description:
          'Valida credenciales con Argon2id. Si la cuenta tiene 2FA activo, el primer intento ' +
          'sin `totpCode` responde 401 con code TOTP_REQUIRED y se debe reintentar incluyendo el ' +
          'código de 6 dígitos. 5 fallos consecutivos bloquean la cuenta 15 minutos. ' +
          'Rate limit: 10 intentos por IP por minuto.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } },
        },
        responses: {
          '200': {
            description: 'Sesión iniciada; cookies establecidas',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthOk' } } },
          },
          '400': errorContent('Datos inválidos (code: VALIDATION)'),
          '401': errorContent(
            'Credenciales inválidas o segundo factor pendiente ' +
              '(codes: INVALID_CREDENTIALS, ACCOUNT_LOCKED, TOTP_REQUIRED, INVALID_TOTP)'
          ),
          '429': errorContent('Demasiados intentos (code: RATE_LIMITED)'),
          '500': errorContent('Error interno (code: INTERNAL)'),
        },
      },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Solicitar recuperación de contraseña',
        description:
          'Envía por correo un enlace de un solo uso (válido 60 min) para crear una contraseña ' +
          'nueva. La respuesta es idéntica exista o no la cuenta (anti-enumeración). ' +
          'Rate limit: 5 por IP cada 15 minutos.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Solicitud aceptada (misma respuesta exista o no el email)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OkOnly' } } },
          },
          '400': errorContent('Email inválido (code: VALIDATION)'),
          '429': errorContent('Demasiados intentos (code: RATE_LIMITED)'),
          '500': errorContent('Error interno (code: INTERNAL)'),
        },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Restablecer la contraseña con un token',
        description:
          'Consume el token recibido por correo (un solo uso, atómico) y fija la contraseña ' +
          'nueva. Revoca todas las sesiones (tokenVersion) y desbloquea la cuenta. ' +
          'Rate limit: 10 por IP por minuto.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string', minLength: 32, maxLength: 128 },
                  password: {
                    type: 'string',
                    minLength: 8,
                    description: 'Misma política del registro: mayúscula y número',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Contraseña actualizada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OkOnly' } } },
          },
          '400': errorContent(
            'Datos inválidos o token expirado/usado (codes: VALIDATION, INVALID_TOKEN)'
          ),
          '429': errorContent('Demasiados intentos (code: RATE_LIMITED)'),
          '500': errorContent('Error interno (code: INTERNAL)'),
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar la sesión',
        description:
          'Usa la cookie `hachiko_refresh` para emitir un nuevo par de tokens. Verifica contra ' +
          'la base que el usuario siga activo, no esté bloqueado y que el token no haya sido ' +
          'revocado por logout (tokenVersion). Rate limit: 30 por IP por minuto.',
        security: [{ refreshCookie: [] }],
        responses: {
          '200': {
            description: 'Tokens renovados; cookies reemplazadas',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OkOnly' } } },
          },
          '401': errorContent(
            'Refresh inválido, revocado o cuenta bloqueada ' +
              '(codes: NO_REFRESH, INVALID_REFRESH, ACCOUNT_LOCKED). Limpia las cookies.'
          ),
          '429': errorContent('Demasiados intentos (code: RATE_LIMITED)'),
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesión (todos los dispositivos)',
        description:
          'Incrementa tokenVersion del usuario, lo que revoca todos los refresh tokens ' +
          'emitidos, y limpia las cookies de esta sesión.',
        security: [{ accessCookie: [] }, {}],
        responses: {
          '200': {
            description: 'Sesión cerrada (idempotente: responde 200 aunque no haya sesión)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OkOnly' } } },
          },
        },
      },
    },
    '/api/me/data-export': {
      get: {
        tags: ['Cuenta'],
        summary: 'Exportar mis datos personales (derecho de acceso, Ley 21.719)',
        description:
          'Devuelve cuenta, direcciones (descifradas) y pedidos del usuario autenticado. ' +
          'Cada exportación queda registrada en DataExportRequest y en la bitácora de auditoría.',
        security: [{ accessCookie: [] }],
        responses: {
          '200': {
            description: 'Datos del usuario',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/DataExport' } },
            },
          },
          '401': errorContent('No autenticado (code: UNAUTHORIZED)'),
          '403': errorContent('Sin permisos (code: FORBIDDEN)'),
        },
      },
    },
    '/api/me/account': {
      delete: {
        tags: ['Cuenta'],
        summary: 'Solicitar eliminación de mi cuenta (derecho de supresión)',
        description:
          'Soft-delete inmediato (la cuenta deja de operar) y purga definitiva programada a ' +
          '30 días. Solo disponible para rol CLIENT. Limpia las cookies de sesión.',
        security: [{ accessCookie: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { reason: { type: 'string', maxLength: 500 } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Eliminación agendada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { ok: { type: 'boolean' }, message: { type: 'string' } },
                },
              },
            },
          },
          '400': errorContent('Datos inválidos (code: VALIDATION)'),
          '401': errorContent('No autenticado (code: UNAUTHORIZED)'),
          '403': errorContent('Solo clientes pueden eliminar su cuenta (code: FORBIDDEN)'),
        },
      },
    },
    '/api/payments/webpay/create': {
      post: {
        tags: ['Pagos'],
        summary: 'Crear transacción Webpay Plus',
        description:
          'Inicia el pago de una orden propia en estado UNPAID. El frontend debe hacer POST ' +
          'del `token` retornado a la `url` de Transbank (form-action permitido por CSP).',
        security: [{ accessCookie: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/OrderRef' } },
          },
        },
        responses: {
          '200': {
            description: 'Transacción creada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: { url: { type: 'string' }, token: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
          '400': errorContent('Datos inválidos (code: VALIDATION)'),
          '401': errorContent('No autenticado (code: UNAUTHORIZED)'),
          '404': errorContent('Orden inexistente, ajena o ya pagada (code: ORDER_NOT_FOUND)'),
        },
      },
    },
    '/api/payments/webpay/commit': {
      get: {
        tags: ['Pagos'],
        summary: 'Retorno de Webpay (confirmación o abandono)',
        description:
          'Endpoint de retorno al que Transbank redirige al comprador. Confirma la transacción ' +
          'contra Transbank (el orderId sale de la respuesta firmada, nunca del query string) y ' +
          'redirige a /checkout/success o /checkout/failure. No es para consumo directo.',
        parameters: [
          {
            name: 'token_ws',
            in: 'query',
            schema: { type: 'string' },
            description: 'Token de la transacción (ausente si el comprador abandonó)',
          },
          {
            name: 'TBK_ORDEN_COMPRA',
            in: 'query',
            schema: { type: 'string' },
            description: 'Solo en el flujo de abandono',
          },
        ],
        responses: {
          '307': { description: 'Redirección a /checkout/success?order=… o /checkout/failure' },
        },
      },
    },
    '/api/payments/mp/preference': {
      post: {
        tags: ['Pagos'],
        summary: 'Crear preferencia de Mercado Pago',
        description:
          'Crea la preferencia de Checkout Pro para una orden propia UNPAID y devuelve el ' +
          '`initPoint` al que redirigir al comprador.',
        security: [{ accessCookie: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/OrderRef' } },
          },
        },
        responses: {
          '200': {
            description: 'Preferencia creada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: { initPoint: { type: 'string', format: 'uri' } },
                    },
                  },
                },
              },
            },
          },
          '400': errorContent('Datos inválidos (code: VALIDATION)'),
          '401': errorContent('No autenticado (code: UNAUTHORIZED)'),
          '404': errorContent('Orden inexistente, ajena o ya pagada (code: ORDER_NOT_FOUND)'),
        },
      },
    },
    '/api/payments/mp/webhook': {
      post: {
        tags: ['Pagos'],
        summary: 'Webhook de notificaciones de Mercado Pago',
        description:
          'Recibe eventos de pago. Verifica la firma HMAC (headers x-signature y x-request-id ' +
          'sobre el data.id del query string) y aplica idempotencia por x-request-id antes de ' +
          'marcar la orden como pagada o fallida.',
        parameters: [
          { name: 'data.id', in: 'query', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string', examples: ['payment'] },
                  data: { type: 'object', properties: { id: { type: 'string' } } },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Evento procesado (o ignorado por idempotencia / tipo no manejado)' },
          '400': { description: 'Firma inválida' },
          '500': { description: 'Fallo de procesamiento (MP reintentará)' },
        },
      },
    },
    '/api/security/incidents/{id}/export': {
      get: {
        tags: ['Seguridad'],
        summary: 'Exportar informe JSON de una incidencia',
        description:
          'Genera el informe completo de la incidencia con su bitácora encadenada por hash ' +
          '(SHA-256) y la verificación de integridad. Solo rol SELLER. La exportación queda ' +
          'auditada con actor, IP y user-agent.',
        security: [{ accessCookie: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Informe descargable (Content-Disposition: attachment)',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          '401': errorContent('No autenticado (code: UNAUTHORIZED)'),
          '403': errorContent('Solo SELLER (code: FORBIDDEN)'),
          '404': errorContent('Incidencia no encontrada (code: NOT_FOUND)'),
        },
      },
    },
    '/api/cron/clean-reservations': {
      get: {
        tags: ['Cron'],
        summary: 'Liberar reservas de stock expiradas',
        description: 'Ejecutado por Vercel cada 5 minutos (vercel.json).',
        security: [{ cronBearer: [] }],
        responses: {
          '200': { description: 'Resumen de reservas liberadas' },
          '401': { description: 'CRON_SECRET ausente o inválido' },
        },
      },
    },
    '/api/cron/clean-audit-logs': {
      get: {
        tags: ['Cron'],
        summary: 'Anonimizar datos de auditoría expirados',
        description: 'Ejecutado por Vercel a diario a las 04:00 UTC (vercel.json).',
        security: [{ cronBearer: [] }],
        responses: {
          '200': { description: 'Resumen de registros anonimizados' },
          '401': { description: 'CRON_SECRET ausente o inválido' },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Healthcheck',
        description: 'Verifica conectividad con la base de datos.',
        responses: {
          '200': {
            description: 'Servicio y base de datos operativos',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    db: { type: 'string', examples: ['connected'] },
                    ts: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '503': { description: 'Base de datos inaccesible' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      accessCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'hachiko_access',
        description: 'JWT de acceso (15 min) en cookie httpOnly, SameSite=Strict',
      },
      refreshCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'hachiko_refresh',
        description: 'JWT de refresco (7 días) con path restringido a /api/auth/refresh',
      },
      cronBearer: {
        type: 'http',
        scheme: 'bearer',
        description: 'CRON_SECRET — solo lo envía el scheduler de Vercel',
      },
    },
    schemas: {
      Error: ErrorResponse,
      OkOnly: okOnly,
      AuthOk: {
        type: 'object',
        required: ['ok', 'data'],
        properties: {
          ok: { type: 'boolean', const: true },
          data: {
            type: 'object',
            properties: { role: { type: 'string', enum: ['CLIENT', 'SELLER'] } },
          },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'consentEssential'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Mínimo 8 caracteres, al menos una mayúscula y un número',
          },
          firstName: { type: 'string', minLength: 1, maxLength: 100 },
          lastName: { type: 'string', minLength: 1, maxLength: 100 },
          consentEssential: {
            type: 'boolean',
            const: true,
            description: 'Consentimiento esencial obligatorio (Ley 21.719)',
          },
          consentMarketing: { type: 'boolean', default: false },
          consentVersion: { type: 'string', default: 'v1.0-2026' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
          totpCode: {
            type: 'string',
            pattern: '^\\d{6}$',
            description: 'Requerido solo si la cuenta tiene 2FA activo',
          },
        },
      },
      OrderRef: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string', description: 'CUID de una orden propia en estado UNPAID' },
        },
      },
      DataExport: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              account: { type: 'object' },
              addresses: { type: 'array', items: { type: 'object' } },
              orders: { type: 'array', items: { type: 'object' } },
              exportedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  },
} as const;
