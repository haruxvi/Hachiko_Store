# 6. Marco legal chileno y cómo se refleja en el sistema

> Este documento explica cómo el diseño del sistema responde a cada ley. **No es asesoría
> legal.** Los textos que ve el cliente están en `src/app/legal/` y conviene que los revise un
> abogado antes de operar con clientes reales.

## Ley 21.719: protección de datos personales

Reemplaza a la Ley 19.628, crea la **Agencia de Protección de Datos Personales** y entra en
plena vigencia en **diciembre de 2026**. Sus ideas centrales y cómo las atiende Hachiko:

| Principio o derecho | Qué exige | Cómo lo atiende Hachiko |
|---|---|---|
| Licitud y consentimiento | Tratar datos con una base legal; el consentimiento debe ser libre, informado y específico | Consentimiento esencial (para comprar) separado del comercial (opcional), con versión, fecha e IP. Aviso de cookies con dos opciones del mismo peso |
| Finalidad y proporcionalidad (minimización) | Pedir solo lo necesario para un fin declarado | El invitado da solo su correo. Con retiro en tienda no se pide dirección. La analítica es anónima salvo consentimiento comercial |
| Seguridad | Medidas técnicas y organizativas adecuadas | Cifrado AES-256-GCM de datos personales, argon2id, control de acceso, bitácora |
| Acceso y portabilidad | Saber qué datos se tienen y recibirlos en un formato reutilizable | `/datos`: descarga en JSON del perfil, las direcciones y los pedidos |
| Rectificación | Corregir datos inexactos | Edición del perfil |
| Supresión | Pedir que se eliminen | Anonimización a los 30 días de la solicitud, conservando solo lo que exige la ley tributaria |
| Oposición | Oponerse a ciertos tratamientos, como el comercial | Interruptor de consentimiento comercial y baja del newsletter en un clic |
| Perfilamiento | Informar y permitir oponerse a decisiones basadas en perfiles | Los segmentos de ML se borran con la cuenta. El fraude solo **sugiere revisar**; nunca decide solo |
| Limitación del plazo de conservación | No guardar datos más de lo necesario | IP y user-agent de la bitácora: 12 meses. Suscripciones no confirmadas: 30 días |
| Notificación de vulneraciones | Informar a la Agencia (y a los titulares, cuando corresponda) | Categoría "vulneración de datos personales" en Incidencias, con el campo "afecta datos personales" y el informe exportable |

**Supresión frente a obligación tributaria.** Borrar todo el pedido haría desaparecer el
respaldo de una venta, que el SII exige conservar. La solución es **anonimizar**: se borra todo
lo que identifica a la persona (correo, nombre, teléfono, dirección) y se conservan los montos,
los productos y las fechas. Así se cumplen ambas normas.

## Ley 19.496: protección de los derechos de los consumidores

| Tema | Qué exige | Cómo lo atiende Hachiko |
|---|---|---|
| **Derecho a retracto** (art. 3 bis) | En compras a distancia, retractarse dentro de 10 días desde que se recibe el producto | Solicitud desde *Mis pedidos*, dentro de 10 días desde la entrega; el cliente elige cambio o devolución del dinero |
| **Garantía legal** (ampliada a 6 meses por la Ley 21.398 de 2021) | Ante un producto con fallas, el consumidor elige reparación, cambio o devolución del dinero | Disponible durante 6 meses desde la entrega, con las tres opciones |
| **Información del precio** | Informar el precio total, impuestos incluidos | Precios en CLP con IVA incluido; el envío se muestra aparte antes de pagar |
| **Términos claros** | Condiciones accesibles antes de contratar | Términos y privacidad enlazados junto al botón de pagar; despacho y devoluciones en `/legal/*`, enlazados en el pie de todas las páginas |

## Ley 21.459: delitos informáticos

Tipifica, entre otros, el **ataque a la integridad de un sistema** (art. 1), el **acceso
ilícito** (art. 2), la **interceptación ilícita** (art. 3), el **ataque a la integridad de los
datos** (art. 4) y el **fraude informático** (art. 7).

Hachiko no "aplica" esta ley (eso lo hacen los tribunales), pero **la prepara para poder
denunciar**:

- Las categorías de Incidencias usan esos mismos artículos.
- La bitácora encadenada por hash da **evidencia íntegra**.
- El informe exportable está pensado para la PDI o la Fiscalía.

## Ley 21.663: marco de ciberseguridad

Crea la **Agencia Nacional de Ciberseguridad (ANCI)** y el CSIRT Nacional, y obliga a reportar
incidentes a los **prestadores de servicios esenciales** y a los **operadores de importancia
vital**.

Una tienda pequeña normalmente no está en esas categorías. Hachiko adopta igual sus prácticas
**de forma voluntaria**: registro de incidentes con fecha de detección, severidad y estados,
registro de la notificación a la autoridad (nombre, referencia y fecha) e informe exportable.
Así, si algún día corresponde reportar, la información ya está ordenada.

## Obligaciones tributarias (SII)

- **Boleta electrónica.** Toda venta debe documentarse con boleta electrónica. Emitirla desde el
  sistema exige el certificado digital del contribuyente y la certificación del SII, o contratar
  un proveedor autorizado de facturación (de pago). **Está fuera del alcance del Capstone.**
  Cada pedido ya guarda el detalle y los totales que la boleta necesita.
- **Conservación.** La información de las ventas debe conservarse durante los plazos que fija el
  Código Tributario. Por eso los pedidos se anonimizan en vez de borrarse.

## Resumen: ley → módulo

| Ley | Módulo del sistema |
|---|---|
| 21.719 | `/datos`, `customer.service.ts`, `pii.ts`, aviso de cookies, retención en `audit.service.ts` |
| 19.496 | `returns.service.ts`, `/pedidos/[id]/devolucion`, `/legal/*` |
| 21.459 | Categorías de `SecurityIncident`, `integrity.ts`, `buildIncidentReport` |
| 21.663 | `/trastienda/seguridad`, registro de notificación a la autoridad |
| SII | Conservación de pedidos anonimizados; boleta fuera de alcance |
