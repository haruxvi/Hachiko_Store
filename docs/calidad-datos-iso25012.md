# Calidad de datos — ISO/IEC 25012

Cómo el modelo de datos de Hachiko (`prisma/schema.prisma`) cumple las características de
calidad de datos de **ISO/IEC 25012**. En un e-commerce el dato es el negocio: si el stock,
el precio o la dirección de despacho están mal, el resultado operativo es erróneo aunque el
código sea perfecto.

## Exactitud

- **Precios y montos como enteros en CLP** (`priceCLP`, `totalCLP: Int`): el peso chileno no
  tiene decimales; usar enteros elimina por diseño los errores de punto flotante en dinero.
- El precio se **congela en el ítem de la orden** (`OrderItem.unitPriceCLP`, `productName`):
  cambiar el catálogo después no altera lo que el cliente compró.
- El monto pagado se toma de la **respuesta firmada de la pasarela**, no del cliente
  (`confirmPaymentAndMarkPaid` recibe el monto de Transbank/MP).
- Teléfonos chilenos validados con patrón estricto (`+56 9 XXXX XXXX`) en Zod antes de
  persistir (`src/lib/validation/schemas.ts`).

## Completitud

- Campos obligatorios a nivel de **esquema de BD** (no solo de UI): una orden no puede
  existir sin montos, dirección de despacho completa ni usuario.
- El consentimiento (`consentEssential`, `consentVersion`, `consentAt`) es obligatorio al
  registrar: no existen usuarios sin base legal de tratamiento (Ley 21.719).
- Zod rechaza en el borde toda entrada incompleta; nada llega "a medias" a los servicios.

## Consistencia

- **Integridad referencial** por claves foráneas en todas las relaciones (Prisma/Postgres).
- **Unicidad** donde el negocio la exige: `User.email`, `Product.sku`, `Product.slug`,
  `Category.slug`, `orderNumber`, `incidentNumber`, `@@unique([orderId, productId])` en
  reservas y `@@unique([incidentId, seq])` en eventos de incidencia.
- **Stock como libro contable**: cada cambio genera un `StockMovement` con
  `previousStock`/`resultingStock`; el stock actual siempre es reconstruible y auditable.
  Los ajustes manuales (`StockAdjustment`) registran actor, razón y delta.
- Creación de orden + reserva en **transacción `Serializable`**: dos compradores
  simultáneos no pueden reservar el mismo último stock.
- Estados modelados como **enums** (`OrderStatus`, `PaymentStatus`, `IncidentStatus`…): no
  existen estados inventados ni typos en producción.

## Credibilidad / Trazabilidad

- `AuditLog` registra quién hizo qué, cuándo, desde qué IP y user-agent para toda acción
  sensible.
- La bitácora de incidencias es **append-only con cadena de hash SHA-256**
  (`src/lib/crypto/integrity.ts`): alterar, borrar o reordenar un evento rompe la cadena de
  forma detectable — el registro es oponible ante auditoría o denuncia.
- Webhooks procesados quedan registrados (`ProcessedWebhook`) → cada cambio de estado de
  pago tiene origen identificable.

## Confidencialidad

- PII cifrada en reposo con AES-256-GCM **a nivel de aplicación** (teléfonos, nombre y
  dirección de despacho): un dump de la BD no expone datos de contacto.
- Principio de minimización: la orden guarda **solo** los datos que el courier necesita
  (comentado explícitamente en el schema); el email no se duplica.
- El descifrado ocurre en los servicios, nunca en la UI, y solo para los roles que lo
  necesitan (vista de despacho del SELLER).

## Actualidad (Currentness)

- `updatedAt` automático en entidades mutables; sellos de tiempo de dominio explícitos
  (`paidAt`, `shippedAt`, `deliveredAt`, `lockedUntil`, `consentAt`…).
- Reservas de stock con expiración (`expiresAt`) y limpieza cada 5 minutos: la
  disponibilidad publicada converge a la real con desfase máximo conocido.

## Cumplimiento (Compliance)

- **Retención limitada**: la IP y el user-agent de los registros de auditoría se anonimizan
  a los **12 meses** por cron diario (`clean-audit-logs`); cuentas eliminadas se purgan a los
  30 días (`DeletionRequest`). Detalle en [`docs/retencion-anonimizacion-datos.md`](./retencion-anonimizacion-datos.md).
- **Derechos ARCO**: exportación completa (`/api/me/data-export`) y supresión
  (`DELETE /api/me/account`), ambas auditadas — Ley 21.719.
- Tipificación de incidencias alineada con la Ley 21.459 (delitos informáticos) y flujo de
  notificación a la autoridad (Ley 21.663).

## Recuperabilidad

- Neon (Postgres gestionado) provee point-in-time recovery; las migraciones de Prisma
  (`prisma/migrations`) reconstruyen el esquema desde cero en cualquier entorno.
- `pnpm db:seed` repone los datos base de catálogo.

---

## Reglas operativas de calidad de datos

1. **Nunca** escribir a la BD sin pasar por un esquema Zod y un servicio.
2. **Nunca** modificar stock sin generar su `StockMovement` (usar siempre
   `inventory.service`).
3. Cambios de esquema **solo** vía `prisma migrate` (jamás SQL manual en producción).
4. Las bitácoras (`AuditLog`, `SecurityIncidentEvent`) son append-only: no existen UPDATE ni
   DELETE sobre ellas en el código, y debe mantenerse así.
