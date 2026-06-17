# Retención y anonimización de datos de auditoría

> Documento de transparencia. Describe el **estado actual implementado** del tratamiento
> de la dirección IP y el identificador de navegador (user-agent) en los registros de
> seguridad de la tienda, conforme a la **Ley 21.719** sobre Protección de Datos Personales.
> Marco legal complementario: **Ley 21.459** (Delitos Informáticos) y **Ley 21.663** (Marco
> de Ciberseguridad).

## Qué datos personales se tratan

El modelo `AuditLog` (`prisma/schema.prisma`) registra, para cada acción relevante:

| Campo        | ¿Dato personal? | Finalidad                                                        |
| ------------ | --------------- | ---------------------------------------------------------------- |
| `ip`         | **Sí**          | Investigar incidentes, prevenir fraude y respaldar denuncias     |
| `userAgent`  | **Sí**          | Identificar el dispositivo/navegador en una investigación        |
| `action`     | No              | Tipo de evento (p. ej. `LOGIN_FAILED`) — traza de auditoría      |
| `actorId`    | Seudónimo       | Referencia interna al usuario, no expone datos de contacto       |
| `targetType` | No              | Tipo de objeto afectado                                          |
| `createdAt`  | No              | Marca temporal del evento                                        |

La IP y el user-agent son los únicos campos del registro tratados como dato personal sujeto
a plazo de conservación.

## Plazo de retención

- **Plazo actual: 12 meses (365 días).**
- Definido como **constante hardcodeada**, no como variable de entorno:
  `AUDIT_PII_RETENTION_DAYS = 365` en [`src/lib/services/audit.service.ts`](../src/lib/services/audit.service.ts).
- No es configurable desde `.env` (no aparece en `.env.example`). Cambiar el plazo requiere
  editar la constante.

Fundamento del plazo (Ley 21.719, principio de limitación del plazo de conservación): 12
meses es proporcional a la finalidad — permite investigar un incidente y respaldar una
denuncia durante una ventana anual — sin retener datos personales más de lo necesario.

## Qué ocurre al vencer el plazo: anonimización, no borrado del registro

Un cron diario ejecuta `anonymizeExpiredAuditData()`. La operación es un `UPDATE`, **no un
`DELETE`**:

```ts
// src/lib/services/audit.service.ts
const cutoff = subDays(new Date(), AUDIT_PII_RETENTION_DAYS); // hoy − 365 días
await db.auditLog.updateMany({
  where: {
    createdAt: { lt: cutoff },
    OR: [{ ip: { not: null } }, { userAgent: { not: null } }],
  },
  data: { ip: null, userAgent: null }, // se vacían ambos campos
});
```

Distinción legal (importante):

- **El registro de auditoría se conserva.** No se elimina la fila: `action`, `actorId`,
  `targetType`, `createdAt`, etc. permanecen como traza de auditoría.
- **La IP y el user-agent se eliminan por completo del registro** (se fijan en `NULL`).
  No se truncan ni se hashean: el valor original es **irrecuperable**. Por tanto, transcurridos
  los 12 meses el registro deja de contener datos personales identificables por esa vía.

Es decir: **anonimización por supresión del campo de PII**, manteniendo la traza no personal.

## Mecanismo y periodicidad

- **Endpoint:** `GET /api/cron/clean-audit-logs`
  ([`src/app/api/cron/clean-audit-logs/route.ts`](../src/app/api/cron/clean-audit-logs/route.ts)).
- **Programación:** `vercel.json` → `"schedule": "0 4 * * *"` → **diario a las 04:00 UTC**.
- **Eliminación automática:** sí. No requiere intervención manual; corre cada día y anonimiza
  todo lo que haya superado los 365 días.
- **Autenticación:** `Authorization: Bearer $CRON_SECRET`, comparación en tiempo constante
  ([`src/lib/auth/cron.ts`](../src/lib/auth/cron.ts)). Si `CRON_SECRET` no está configurado,
  el endpoint responde 401 (cerrado por defecto).

## Tablas afectadas

| Modelo                  | ¿Lo toca el cron? | Observación                                                       |
| ----------------------- | ----------------- | ----------------------------------------------------------------- |
| `AuditLog`              | **Sí**            | Único modelo anonimizado (campos `ip` y `userAgent`)              |
| `SecurityIncident`      | No                | Append-only; no almacena IP de clientes                           |
| `SecurityIncidentEvent` | No                | Bitácora encadenada por hash (SHA-256); inmutable por diseño      |

El registro interno de incidencias (`SecurityIncident` / `SecurityIncidentEvent`) **no contiene
datos personales de clientes** y se conserva como evidencia auditable, por lo que queda fuera
del alcance de la anonimización.

## Coherencia con la información al titular

El plazo de 12 meses y el mecanismo (eliminación de IP y navegador, conservando tipo de evento
y fecha) están declarados al usuario en la **Política de Privacidad**, sección 3
([`src/app/legal/privacidad/page.tsx`](../src/app/legal/privacidad/page.tsx)). Código y aviso
legal están alineados.

## Si se modifica el plazo

El plazo se define en **un único punto** (`AUDIT_PII_RETENTION_DAYS`). Cualquier cambio debe
mantener la coherencia con:

1. `src/lib/services/audit.service.ts` — la constante y su comentario justificativo.
2. `src/app/legal/privacidad/page.tsx` — el texto «12 meses» visible al usuario.
3. Este documento.
