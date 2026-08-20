# Análisis de datos y Machine Learning — Arquitectura y funcionamiento

Documentación del subsistema de inteligencia de Hachiko: análisis de datos y machine
learning sobre la base de e-commerce existente. Al igual que el resto de la documentación,
el objetivo es que el proceso **no dependa del programador de turno**: cualquier integrante
del equipo —o la comisión evaluadora— encuentra aquí qué se construyó, por qué, y cómo se
ejecuta y verifica.

Metodología de referencia: **CRISP-DM** (Cross-Industry Standard Process for Data Mining),
el estándar de facto para proyectos de ciencia de datos. Se integra al ciclo de vida ya
documentado en `docs/ciclo-de-vida-iso12207.md`.

---

## 1. Motivación y alcance

El proyecto partió como un e-commerce con pasarela de pago y un fuerte componente de
ciberseguridad y cumplimiento legal chileno. El subsistema de ML **no reemplaza** esa base:
la aprovecha. Sobre los datos transaccionales que ya se generan (ventas, inventario,
comportamiento) se construyen modelos predictivos y análisis descriptivos que apoyan la
operación de la tienda.

Principio de diseño rector: **cada fase es un entregable completo y defendible por sí
mismo.** El alcance crece hacia afuera; si el tiempo se acota, se corta en cualquier fase
con un resultado cerrado. La ciberseguridad no queda como un anexo: la IA y la seguridad se
refuerzan mutuamente (detección de fraude, perfilado con consentimiento, modelos
auditables).

Las capacidades objetivo se agrupan por fase en la §8.

---

## 2. Decisión arquitectónica central

> **El entrenamiento corre FUERA de Vercel. Next.js y el pipeline de Python NO se comunican
> por una API entre servicios: se comunican a través de la base de datos Neon que ya
> comparten.**

Justificación:

- **Vercel es serverless.** Las funciones tienen límite de ejecución (10–60 s), no mantienen
  un proceso vivo, y las librerías de ML (`scikit-learn`, `prophet`, `pandas`) son demasiado
  pesadas para el bundle. No es un entorno de entrenamiento.
- **Python es el ecosistema de ML.** Node/Next no lo es.
- **Menor superficie de ataque.** No se expone ningún servicio de inferencia a Internet. El
  pipeline corre interno y programado; el único punto de contacto es la base de datos, ya
  asegurada.

### 2.1 Los dos planos

```
┌──────────────────────────────┐        ┌───────────────────────────────┐
│  PLANO OPERACIONAL (OLTP)    │        │   PLANO ANALÍTICO / ML        │
│  esquema existente — intacto │        │                               │
│  User, Product, Order,       │──lee──▶│  Entrenamiento batch (Python) │
│  OrderItem, StockMovement... │ crudo  │  /ml — pandas, scikit, prophet│
│                              │        │                               │
│  + AnalyticsEvent (captura)  │        │  se ejecuta en GitHub Actions │
│  + OrderStatusHistory        │        │  (cron) — NUNCA en Vercel     │
└──────────────────────────────┘        └───────────────┬───────────────┘
              ▲                                          │ escribe
              │   Next.js LEE resultados con Prisma      │ predicciones
              │                                          ▼
              └──────────────  DemandForecast, ProductRecommendation,
                               RestockSuggestion, KpiSnapshot,
                               CustomerSegment, RiskScore, ModelRun
```

- El **plano operacional** es el esquema de siempre. Sirve la tienda: comprar, cobrar,
  despachar. Debe ser rápido y limpio. Se le agregan solo dos tablas de captura (§4).
- El **plano analítico** son tablas derivadas que el pipeline calcula y la trastienda
  consume. Reentrenar no exige migraciones ni contamina las entidades núcleo.

Es el mismo patrón **"estado actual + bitácora/derivados"** que el proyecto ya aplica con
`Product.stock` + `StockMovement`: el estado vive en la entidad; la historia y los cálculos,
en tablas append-only aparte.

---

## 3. Regla de propiedad del esquema

**Prisma es el único dueño del DDL.** Crea y altera tablas mediante su flujo habitual
(`db push` / migraciones). El pipeline de Python **nunca** ejecuta DDL: solo hace `SELECT`
sobre las tablas operacionales e `INSERT`/`UPSERT` sobre las derivadas. Si Python pudiera
migrar el esquema, ambos sistemas competirían por él. Esta regla está codificada en
`ml/ml/db.py` y repetida en `ml/README.md`.

---

## 4. Modelo de datos del plano analítico

Definido en `prisma/schema.prisma`, sección "PLANO ANALÍTICO / ML". Ninguna de estas tablas
altera las operacionales; las relaciones agregadas a `Product` y `Order` son virtuales (no
añaden columnas a esas tablas).

### 4.1 Captura (dato nuevo)

| Tabla | Propósito |
|---|---|
| `AnalyticsEvent` | Comportamiento de navegación (vistas, búsquedas, carrito). Append-only, alto volumen. Es lo **único** que capta dato nuevo; habilita recomendador, embudo de conversión y análisis de búsquedas sin resultado. `userId` null = visitante anónimo. |
| `OrderStatusHistory` | Bitácora de transiciones de estado del pedido. Convive con los timestamps denormalizados de `Order` (`paidAt`, `shippedAt`, `deliveredAt`). Habilita analítica temporal: tiempo en cada estado, SLA por courier, cuellos de botella, predicción de tiempo de entrega. |

### 4.2 Gobernanza

| Tabla | Propósito |
|---|---|
| `ModelRun` | Registro de cada corrida de entrenamiento (tipo, versión, estado, métricas). Da **trazabilidad**: toda predicción referencia el `modelRunId` que la generó. Es el espejo analítico del `AuditLog`. |

### 4.3 Derivadas (predicciones que la trastienda lee)

| Tabla | Alimenta | Fase |
|---|---|---|
| `KpiSnapshot` | Dashboards de KPIs (mensuales/anuales), con desgloses por categoría/región/courier | 1 |
| `DemandForecast` | Pronóstico de demanda por producto y periodo (estacionalidad, "fiestas patrias") | 2 |
| `RestockSuggestion` | "Qué comprar y cuánto" — sugerencia de reposición | 2 |
| `ProductRecommendation` | "Se compran juntos" (market basket / item-item / contenido) | 2 |
| `CustomerSegment` | Segmentación RFM + clustering de clientes | 2 |
| `RiskScore` | Fraude en órdenes, account takeover, riesgo de usuario | 3 |

---

## 5. Funcionamiento del pipeline

### 5.1 Flujo de una corrida

1. Un job abre un `ModelRun` (estado `RUNNING`) — ver `ml/ml/model_run.py`.
2. Lee datos operacionales a un `DataFrame` de pandas (`ml/ml/db.py: read_sql`).
3. Entrena / calcula (según el job: forecast, RFM, market basket, ...).
4. Escribe las predicciones en la tabla derivada correspondiente, etiquetadas con el
   `modelRunId`.
5. Cierra el `ModelRun` como `SUCCESS` con sus métricas (MAE, precisión, silhouette...), o
   como `FAILED` si algo falla.
6. Next.js lee los resultados con Prisma. Para el cliente son filas ya calculadas: carga
   instantánea, sin latencia de modelo ni llamada a Python en la ruta de request.

### 5.2 Trazabilidad (ModelRun)

Todo job usa el context manager `model_run()`:

```python
from ml.model_run import model_run
from ml.db import read_sql

with model_run("demand_forecast", "0.1.0") as run:
    ventas = read_sql('SELECT ... FROM "OrderItem" ...')
    # ... entrenar, escribir DemandForecast con modelRunId=run.id ...
    run.set_rows_in(len(ventas))
    run.set_metrics({"mae": 3.2})
```

Ante cualquier predicción se puede responder **qué modelo y versión la produjo**, requisito
de la gobernanza de la Fase 5 (monitoreo de *drift*, explicabilidad).

### 5.3 Conexión a Neon

Se usa la conexión **directa** (`DIRECT_URL`, no pooled): los jobs son de larga duración y
saturarían el pooler serverless. En local, `DIRECT_URL` se toma del `.env` de la raíz del
repositorio (no se duplica el secreto). En CI, viene del secret `NEON_DIRECT_URL` y no se
sobrescribe.

---

## 6. Estructura del proyecto `/ml`

```
ml/
├── requirements.txt        Núcleo (conexión + datos) + libs por fase (comentadas)
├── README.md               Guía de arranque rápido
├── .gitignore              Ignora .venv, __pycache__, .env
├── ml/
│   ├── db.py               Conexión a Neon (DIRECT_URL), read_sql, new_id
│   └── model_run.py        Trazabilidad de entrenamientos (ModelRun)
├── jobs/
│   └── smoke_test.py       Hito Fase 0: pipeline de punta a punta
└── notebooks/              Exploración de datos (CRISP-DM: Data Understanding)
```

Es un proyecto Python **independiente**: su propio entorno virtual y dependencias, sin
mezclarse con Node. Vive en el mismo repositorio para versionar todo junto.

### 6.1 Ejecución local

```bash
cd ml
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt      # Windows
.venv\Scripts\python -m jobs.smoke_test
```

`smoke_test` no entrena nada real: demuestra que Python puede **leer** el esquema operacional
y **escribir** una fila en el plano analítico con trazabilidad. Es el criterio de aceptación
de la Fase 0.

---

## 7. Ejecución programada (fuera de Vercel)

El batch corre en **GitHub Actions** (`.github/workflows/ml-train.yml`): gratuito,
programado, reproducible y versionado — apropiado para el contexto de tesis.

- Disparadores: `schedule` (cron diario) y `workflow_dispatch` (manual desde la pestaña
  Actions).
- La credencial de Neon se guarda como secret del repositorio (`NEON_DIRECT_URL`), nunca en
  el código.

Alternativas equivalentes si se requiere un proceso persistente: un worker con cron en
Railway/Render/Fly.io. **No** se necesita un servicio de inferencia en vivo (FastAPI): todas
las capacidades planificadas son precalculables por batch.

---

## 8. Fases y capacidades (hoja de ruta)

| Fase | Foco | Capacidades | Estándar CRISP-DM |
|---|---|---|---|
| **0** | Cimientos | Plano analítico en Prisma, `/ml`, GitHub Actions, dataset sintético, shell de UI | Business Understanding |
| **1** | Descriptivo (BI) | KPIs mensuales/anuales, clasificación ABC, margen por producto/categoría, mapa geo por comuna, análisis de mermas | Data Understanding |
| **2** | Predictivo (núcleo) | Forecast de demanda estacional, segmentación RFM + clustering, recomendador market-basket, sugerencia de reposición | Modeling |
| **3** | Seguridad inteligente | Detección de fraude en órdenes, account takeover / credential stuffing, scoring de riesgo, analítica de incidentes | Modeling / Evaluation |
| **4** | Cliente y conversión | Churn / CLV, embudo de conversión, carritos abandonados, búsquedas sin resultado | Modeling / Evaluation |
| **5** | Gobernanza (empresarial) | Versionado de modelos + *drift*, explicabilidad (SHAP), alertas automáticas, reporte mensual PDF | Deployment |

Estado actual: **Fases 0 a 5 implementadas.** Fase 0: cimientos. Fase 1: KPIs descriptivos.
Fase 2: núcleo predictivo (forecast, reposición, recomendador, RFM+KMeans). Fase 3: seguridad
inteligente (fraude, account-takeover, incidentes). Fase 4: cliente y conversión (embudo,
carritos, búsquedas sin resultado, CLV). Fase 5: gobernanza (historial y trazabilidad de
modelos). Diez vistas en la trastienda (grupo "Inteligencia"): Métricas, Demanda, Qué reponer,
Logística, Recomendaciones, Clientes, Conversión, Riesgo, Modelos, Reporte. El orquestador
`jobs/train_all.py` corre los modelos en orden.

Ampliaciones adicionales (BI de solo lectura, sin jobs nuevos): productos en alza/baja,
mermas, sobre-stock (capital inmovilizado), packs sugeridos, anomalías de ventas, logística
(demanda y costo de envío por región, SLA por courier), recompra/churn, alertas automáticas
(KPI fuera de rango) y reporte imprimible a PDF.

**Elasticidad-precio (preparada):** el vendedor edita precios desde Trastienda → Productos.
Cada cambio se registra en `PriceHistory` (append-only, con auditoría del actor), de modo que
el historial real de precios se acumula con el uso y habilita el análisis de elasticidad-precio
más adelante — sin datos inventados.

### 8.5 Fases 4 y 5

- **Fase 4 (cliente y conversión):** sobre `AnalyticsEvent` (poblado por
  `prisma/seed-analytics-events.ts`), el servicio calcula el embudo view→cart→checkout, los
  carritos abandonados (y cuáles son recuperables respetando consentimiento) y las búsquedas
  sin resultado (demanda insatisfecha). El CLV histórico se agrega en la vista Clientes; el
  churn está cubierto por los segmentos RFM `en_riesgo`/`hibernando`.
- **Fase 5 (gobernanza):** la vista Modelos lee el historial de `ModelRun` — versión, estado,
  métricas, duración y última corrida por modelo — dando trazabilidad y monitoreo (MLOps).

### 8.4 Fase 3 — Seguridad inteligente (en curso)

`ml/jobs/fraud_detection.py`: **Isolation Forest** (no supervisado) sobre features de cada
orden (monto, nº de ítems y unidades, hora, invitado, retiro, precio medio) detecta pedidos
atípicos y escribe los marcados en `RiskScore` (subjectType=ORDER), con un score 0..1 y las
señales que lo dispararon (explicabilidad). La vista `trastienda/riesgo` los lista para revisión.

`ml/jobs/account_takeover.py`: analiza los `LOGIN_FAILED` de `AuditLog` para detectar cuentas
bajo ataque — **fuerza bruta** (muchos fallos sobre una cuenta) y **credential stuffing** (una
IP que golpea muchas cuentas distintas) — y escribe las cuentas en `RiskScore`
(subjectType=USER). La vista muestra un identificador pseudónimo, sin exponer email ni datos
del cliente (privacidad por diseño, §9). Los eventos de prueba los genera
`prisma/seed-security-events.ts` (`pnpm db:seed:security`).

La **analítica de incidentes** (`getIncidentAnalytics` en el servicio) resume el registro de
`SecurityIncident`: total, abiertos, cuántos afectan datos personales, MTTR (tiempo medio de
resolución) y distribución por categoría — todo en la vista `trastienda/riesgo`.

Principio transversal de Fase 3: el modelo **sugiere**, la decisión es humana (no hay decisión
automática con efecto jurídico — ver §9). Fase 3 completa.

### 8.3 Fase 2 — Núcleo predictivo

Modelos en scikit-learn (evita la dependencia pesada de Prophet, que no tiene wheels para
Python 3.14):

- **Forecast de demanda** (`forecast_demand.py`): regresión Ridge por producto con features de
  calendario (mes-del-año one-hot) + tendencia. Predice 3 meses → `DemandForecast`. Los
  coeficientes por mes son índices estacionales interpretables.
- **Reposición** (`restock.py`): combina el forecast del próximo periodo con el stock y un
  lead time de proveedor → días a quiebre y cantidad sugerida → `RestockSuggestion`.
- **Recomendador** (`market_basket.py`): reglas de asociación (soporte, confianza, lift) sobre
  las canastas → `ProductRecommendation` (BASKET).
- **Segmentación RFM** (`customer_rfm.py`): scores de Recencia/Frecuencia/Monto por quintiles,
  segmento nombrado y clustering KMeans (con silhouette) → `CustomerSegment`. Opera sobre
  `userId`, sin PII (Ley 21.719).

### 8.2 Fase 1 — Analítica descriptiva

`ml/jobs/kpi_snapshots.py` agrega las ventas pagadas y escribe `KpiSnapshot`: serie temporal
mensual/anual (ingresos, órdenes, unidades, margen), desglose por categoría, por producto
(para la clasificación ABC — Pareto por ingresos) y por comuna. La vista
`app/(panel)/trastienda/metricas` lo consume vía `intelligence.service.ts` (regla: la UI no
toca `db` directo). Es un refresh completo idempotente, etiquetado con su `ModelRun`.

### 8.1 Dataset sintético

Los modelos requieren historia; una tienda nueva no la tiene. `prisma/seed-synthetic.ts`
genera ~24 meses de operación coherente (≈9.000 pedidos) directamente en Neon vía Prisma,
con estacionalidad inyectada (18 de septiembre, Navidad, CyberDay), tendencia de crecimiento,
afinidad de canasta, geografía chilena, movimientos de inventario (incluidas mermas) y
bitácora temporal de estados. Es transparente para la comisión: los datos van marcados como
sintéticos (usuarios `@seed.hachiko.test`, SKU `SYN-###`) y el script es idempotente —
re-ejecutarlo limpia lo sintético anterior y regenera, sin tocar datos reales. Comando:
`pnpm db:seed:synthetic`.

---

## 8.6 Datos de demostración (seeds) — guía para el equipo

Los modelos necesitan datos para funcionar. En desarrollo se generan con **datos
sintéticos** (falsos, marcados y borrables), nunca con datos reales de clientes. Son tres
comandos, y el **orden importa** (cada uno depende del anterior):

```bash
pnpm db:seed:synthetic   # 1) ~24 meses de catálogo, clientes y ~9.000 pedidos con estacionalidad
pnpm db:seed:security    # 2) eventos de login fallidos + incidentes (para la vista Riesgo)
pnpm db:seed:analytics   # 3) eventos de navegación/carrito (para la vista Conversión)
```

O todo de una:

```bash
pnpm db:seed:synthetic && pnpm db:seed:security && pnpm db:seed:analytics
```

Qué hace cada uno:

| Comando | Puebla | Alimenta las vistas |
|---|---|---|
| `db:seed:synthetic` | `Product`, `User`, `Order`, `OrderItem`, `StockMovement`, `OrderStatusHistory` | Métricas, Demanda, Qué reponer, Recomendaciones, Clientes, Logística, Riesgo |
| `db:seed:security` | `AuditLog` (LOGIN_FAILED, ACCOUNT_LOCKED), `SecurityIncident` | Riesgo (cuentas bajo ataque + incidentes) |
| `db:seed:analytics` | `AnalyticsEvent` (vistas, búsquedas, carrito) | Conversión |

Puntos clave para no perderse:

1. **Necesitas `DATABASE_URL`/`DIRECT_URL` en tu `.env`** (apuntando a tu base/branch de Neon).
   Sin eso, los seeds fallan.
2. **`db:seed:synthetic` va SIEMPRE primero.** Los otros dos referencian los usuarios y
   productos que él crea. Si corres `security` o `analytics` sin haber corrido `synthetic`,
   avisan que no hay datos y no hacen nada.
3. **Son idempotentes:** cada seed borra primero *su* data sintética anterior y la regenera.
   Re-ejecutar no duplica. Nunca tocan datos reales (se identifican por marcadores:
   usuarios `@seed.hachiko.test`, SKU `SYN-`, `metadata.synthetic=true`, `reportedBy='synthetic-seed'`).
4. **Después de re-sembrar, corre el pipeline de ML** para recalcular las predicciones sobre
   los datos nuevos:
   ```bash
   cd ml && .venv/Scripts/python -m jobs.train_all   # Windows
   ```
   (Los ids cambian al re-sembrar, así que las tablas derivadas hay que regenerarlas.)
5. En **producción no se corren los seeds** — ahí los datos son reales. Los seeds son solo
   para desarrollo, demo y la defensa de la tesis.

## 9. Privacidad y seguridad — cumplimiento (Ley 21.719)

El subsistema de ML se diseña con **privacidad por diseño**, coherente con
`docs/retencion-anonimizacion-datos.md` y `docs/seguridad-owasp.md`:

- **Consentimiento.** El perfilado y las recomendaciones personalizadas solo operan sobre
  usuarios con `consentMarketing = true`. Los demás reciben únicamente agregados anónimos.
- **Minimización / pseudonimización.** El plano analítico entrena sobre datos
  pseudonimizados: nunca accede a PII en claro (email, teléfono cifrado). `AnalyticsEvent`
  agrega y desidentifica en el pipeline.
- **Trazabilidad.** Cada decisión relevante del modelo queda registrable en `AuditLog`, y
  cada predicción referencia su `ModelRun`.
- **Superficie de ataque.** No se expone un servicio de inferencia a Internet; el pipeline es
  interno y el único acoplamiento es la base de datos ya asegurada.

---

## 10. Verificación (criterios de aceptación)

| Ítem | Cómo se verifica | Estado |
|---|---|---|
| Tablas del plano analítico existen y son consultables | `pnpm tsx scripts/verify-analytics-plane.ts` (9 tablas, 0 filas) | ✅ |
| Esquema operacional intacto | `pnpm prisma validate`; relaciones nuevas son virtuales | ✅ |
| Pipeline Python↔Neon↔Next end-to-end | `python -m jobs.smoke_test` escribe `ModelRun`; Next lo lee con Prisma | ✅ |
| Entrenamiento fuera de Vercel | `.github/workflows/ml-train.yml` (cron + manual) | ✅ (config) |

---

## 11. Artefactos del repositorio

| Artefacto | Ubicación |
|---|---|
| Esquema del plano analítico | `prisma/schema.prisma` — sección "PLANO ANALÍTICO / ML" |
| Generador de dataset sintético | `prisma/seed-synthetic.ts` (`pnpm db:seed:synthetic`) |
| Job de KPIs (Fase 1) | `ml/jobs/kpi_snapshots.py` |
| Jobs de Fase 2 | `ml/jobs/{forecast_demand,restock,market_basket,customer_rfm}.py` |
| Jobs de Fase 3 | `ml/jobs/{fraud_detection,account_takeover}.py` |
| Seed de eventos de seguridad | `prisma/seed-security-events.ts` (`pnpm db:seed:security`) |
| Seed de eventos de comportamiento | `prisma/seed-analytics-events.ts` (`pnpm db:seed:analytics`) |
| Orquestador del pipeline | `ml/jobs/train_all.py` |
| Servicio de lectura (trastienda) | `src/lib/services/intelligence.service.ts` |
| Vistas de inteligencia | `src/app/(panel)/trastienda/{metricas,demanda,reponer,recomendaciones,clientes}/page.tsx` |
| Conexión y helpers | `ml/ml/db.py` |
| Trazabilidad de modelos | `ml/ml/model_run.py` |
| Job de prueba end-to-end | `ml/jobs/smoke_test.py` |
| Dependencias Python | `ml/requirements.txt` |
| Ejecución programada | `.github/workflows/ml-train.yml` |
| Verificación del esquema | `scripts/verify-analytics-plane.ts` |
| Guía de arranque | `ml/README.md` |
