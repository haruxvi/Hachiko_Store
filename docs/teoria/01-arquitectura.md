# 1. Arquitectura: decisiones y alternativas

Cada decisión se presenta como un registro breve (estilo ADR): **contexto**, **decisión**,
**alternativas descartadas** y **consecuencias**. Cómo está implementado:
[../codigo/01-panorama.md](../codigo/01-panorama.md).

---

## D1. Monolito modular en lugar de microservicios

- **Contexto.** Una pyme con un equipo pequeño, un solo dominio de negocio (vender productos) y
  tres interfaces (web, PWA y app).
- **Decisión.** Una sola aplicación Next.js con capas internas bien separadas: entrada →
  servicios → datos. Cada regla vive una sola vez en `src/lib/services/`.
- **Alternativa descartada: microservicios** (pedidos, pagos e inventario por separado). Dan
  despliegue y escalado independientes, pero a cambio de transacciones distribuidas (un pedido y
  su stock en bases distintas exigen *sagas*), latencia de red entre servicios, más
  infraestructura y más puntos de falla. Nada de eso se justifica a esta escala.
- **Consecuencias.** Crear un pedido y reservar su stock cabe en **una transacción ACID** de la
  misma base, que es la forma más simple y segura de evitar la sobreventa. Si algún día una
  parte necesitara escalar sola, las capas ya marcan dónde cortar.

## D2. Renderizado en el servidor (React Server Components)

- **Contexto.** Una tienda donde importan el tiempo de carga en el celular, el SEO y no exponer
  lógica en el navegador.
- **Decisión.** Las páginas son Server Components: consultan la base en el servidor y envían
  HTML. Solo las partes interactivas son Client Components. Las mutaciones son Server Actions.
- **Alternativa descartada: SPA pura** (React en el navegador más una API REST para todo).
  Manda más JavaScript, muestra la página en blanco mientras carga y obliga a exponer una API
  para cada pantalla.
- **Consecuencias.** Menos JavaScript en el teléfono y datos siempre frescos (las páginas de la
  tienda son dinámicas). La CSP con *nonce* obliga a no prerenderizar, a cambio de un costo de
  renderizado aceptado.

## D3. Serverless (Vercel)

- **Contexto.** Tráfico bajo y variable; sin equipo de infraestructura.
- **Decisión.** Funciones serverless: cada petición corre en una instancia que la plataforma
  crea y destruye.
- **Consecuencias, y cómo se manejan:**
  - **No hay memoria compartida entre instancias.** Por eso el límite de frecuencia puede usar
    Redis (Upstash), y por eso nada importante se guarda en memoria.
  - **Muchas conexiones cortas a la base.** Por eso la app usa el *pooler* de Neon y deja la
    conexión directa para los procesos largos.
  - **Tiempos máximos por petición.** Por eso el ML no corre aquí (ver D6).
  - **Sin procesos residentes.** Las tareas periódicas son crons que llaman a un endpoint
    protegido.

## D4. Base relacional (PostgreSQL) con un ORM dueño del esquema

- **Contexto.** Dinero, stock y pedidos: datos con relaciones fuertes que no pueden quedar
  inconsistentes.
- **Decisión.** PostgreSQL, con transacciones ACID y aislamiento Serializable. Prisma es el
  **único** que define y cambia tablas, y el pipeline de Python solo hace `SELECT` e
  `INSERT`/`DELETE` en tablas derivadas.
- **Alternativa descartada: NoSQL documental.** Es flexible, pero la consistencia entre
  colecciones (pedido ↔ stock ↔ pago) quedaría en manos del código de la aplicación.
- **Consecuencias.** Las restricciones (`@unique`, claves foráneas) y el aislamiento las
  garantiza la base, no la disciplina del programador.

## D5. Bitácoras de solo inserción (*append-only*)

- **Decisión.** El stock, los precios, los estados del pedido y las acciones se guardan como
  **historial de eventos** además del valor actual: `StockMovement`, `PriceHistory`,
  `OrderStatusHistory` y `AuditLog`.
- **Concepto.** Es la idea central del *event sourcing*, sin llevarlo al extremo: el valor actual
  (por ejemplo, `Product.stock`) se guarda para leer rápido, y el historial permite auditar,
  reconstruir y analizar.
- **Consecuencias.** Se puede explicar cualquier número ("¿por qué hay 3 unidades?"), y estas
  tablas son la materia prima del ML y de la elasticidad.

## D6. Dos planos de datos e inferencia por lotes

- **Contexto.** Los modelos usan pandas y scikit-learn (Python), y entrenarlos toma segundos o
  minutos.
- **Decisión.** Hay un **plano operacional** (OLTP: la tienda) y un **plano analítico** (tablas
  de predicciones) en la misma base. Un pipeline en Python corre **una vez al día** en GitHub
  Actions, lee el plano operacional y escribe el analítico. La trastienda solo lee resultados ya
  calculados.
- **Alternativas descartadas.**
  - **Inferencia en línea** (un servicio de ML, por ejemplo FastAPI, que responda en cada
    visita): agrega un servicio permanente sin necesidad, porque ninguna decisión del negocio
    cambia de un minuto a otro.
  - **Un *data warehouse* separado:** excesivo para el volumen actual.
- **Consecuencias.** La tienda nunca espera a un modelo. Si el pipeline falla, la tienda sigue
  vendiendo y la trastienda muestra la última corrida. Cada predicción es trazable a su
  `ModelRun`.

## D7. Un backend para tres interfaces

- **Decisión.**
  - La web y la PWA usan Server Components, Server Actions y cookies.
  - La app nativa usa una **API v1** con token Bearer y respuestas uniformes `{ ok, data }`.
  - Ambas llaman a los mismos servicios.
- **Por qué la app no paga por su cuenta.** Integrar Webpay y Mercado Pago en nativo duplicaría
  el flujo más delicado del sistema. La app abre el checkout web en el navegador seguro del
  teléfono, y el servidor recalcula precios y stock.
- **Consecuencias.** Existe un solo flujo de pago, probado y auditado. La app es una "vista" más
  del mismo sistema.

## D8. Seguridad por diseño (*secure by default*)

- **Decisión.** Defensa en profundidad y *fail-closed*: varias capas independientes (CSP, RBAC
  en tres niveles, validación en el servidor, cifrado en reposo), y ante la duda se rechaza.
- **Consecuencias.** Un error en una capa no abre el sistema. Ver
  [03-seguridad.md](03-seguridad.md).

---

## Atributos de calidad que guían estas decisiones (ISO/IEC 25010)

| Atributo | Cómo lo atiende la arquitectura |
|---|---|
| Fiabilidad | Transacciones Serializable, idempotencia y reservas con vencimiento |
| Seguridad | D8, más cifrado de datos personales y bitácoras con integridad |
| Mantenibilidad | Capas, una regla en un solo lugar, módulos compartidos web/app |
| Eficiencia | Renderizado en el servidor e inferencia por lotes |
| Portabilidad | Docker local idéntico para el equipo y la comisión; el ML corre en cualquier runner con Python |

Más detalle en [calidad-iso25010.md](../calidad-iso25010.md).
