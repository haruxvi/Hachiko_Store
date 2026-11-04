# Cómo funciona el código de Hachiko

Guía para entender el sistema por dentro: primero la vista general y después cada
subsistema, con el archivo exacto donde vive cada regla. Está escrita para el equipo y
para la comisión. Si buscas el **por qué** de las decisiones (transacciones, criptografía,
modelos, leyes), está en [`../teoria/`](../teoria/README.md).

> Todo lo que se afirma aquí se puede comprobar abriendo el archivo enlazado. Si cambias
> una regla en el código, actualiza también el documento que la menciona.

## Orden de lectura sugerido

**Visión general**

| # | Documento | Qué responde |
|---|---|---|
| 1 | [Panorama y arquitectura](01-panorama.md) | Qué es Hachiko, sus capas y planos de datos, el recorrido de una petición y dónde está cada cosa |
| 7 | [El backend](07-backend.md) | Puertas de entrada, servicios, acceso a datos, validación, formato de errores, límites de frecuencia, correos y crons |
| 8 | [El frontend web](08-frontend.md) | Server y Client Components, rutas y layouts, estado, sistema visual, PWA y accesibilidad |
| 11 | [La app móvil](11-app-movil.md) | Estructura Expo, modos cliente y vendedor, sesión, caché de datos y cómo paga |

**Flujos de negocio**

| # | Documento | Qué responde |
|---|---|---|
| 2 | [Cuentas, sesiones y roles](02-autenticacion.md) | Registro, login, 2FA, sesiones, renovación, bloqueo e invitados |
| 3 | [Del carrito al pedido](03-compra.md) | Catálogo, carrito, checkout, reserva de stock y el puente app → web |
| 4 | [Pagos y reembolsos](04-pagos-y-reembolsos.md) | Webpay, Mercado Pago, confirmación atómica, idempotencia y la cola de reembolsos |
| 5 | [Despacho y postventa](05-despacho-y-postventa.md) | Estados del pedido, despacho, seguimiento, retiro en tienda, cambios y devoluciones |
| 6 | [Catálogo e inventario](06-catalogo-e-inventario.md) | Stock, reservas, libro de movimientos, historial de precios, carga masiva e imágenes |
| 9 | [Inteligencia (BI y ML)](09-inteligencia.md) | Del pipeline de Python a la trastienda, qué es ML y qué es BI, alertas y elasticidad |

**Transversales**

| # | Documento | Qué responde |
|---|---|---|
| 10 | [Seguridad y privacidad](10-seguridad-y-privacidad.md) | Mapa de controles, qué se cifra, bitácora, incidencias, derechos ARCOP, retención y consentimiento |
| 12 | [Operación](12-operacion.md) | Dónde corre cada pieza, workflows, crons, variables de entorno y Docker |
| 13 | [Pruebas](13-pruebas.md) | Qué demuestra cada nivel de pruebas y dónde está cada caso |

## Documentos que ya existían y se complementan

| Tema | Documento |
|---|---|
| OWASP Top 10 control por control | [seguridad-owasp.md](../seguridad-owasp.md) |
| Pentest local (34 verificaciones) | [pentest-local-2026-10.md](../pentest-local-2026-10.md) |
| Machine learning (CRISP-DM, cada modelo y su línea de entrenamiento) | [machine-learning.md](../machine-learning.md) |
| Referencia de la API y OpenAPI | [api.md](../api.md) |
| Despliegue y Docker local | [deploy.md](../deploy.md) · [despliegue-local-docker.md](../despliegue-local-docker.md) |
| Retención y anonimización | [retencion-anonimizacion-datos.md](../retencion-anonimizacion-datos.md) |
| Normas de calidad (ISO 25010, 25012, 12207, IEEE 730, CMMI) | [calidad-iso25010.md](../calidad-iso25010.md) y siguientes |
