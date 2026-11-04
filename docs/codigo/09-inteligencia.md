# 9. Inteligencia (BI y ML)

El detalle de cada modelo, con la metodología CRISP-DM y la línea exacta de entrenamiento, está
en [machine-learning.md](../machine-learning.md). Aquí se explica **cómo se conecta** todo con la
tienda. La teoría (Ridge, KMeans, Isolation Forest, lift, elasticidad) está en
[../teoria/05-datos-y-ml.md](../teoria/05-datos-y-ml.md).

## El flujo de punta a punta

```
1. La tienda opera            2. Cada día, 06:00 UTC              3. La trastienda lee
─────────────────────         ─────────────────────────           ─────────────────────
Order, OrderItem,     ──lee──► GitHub Actions: ml-train.yml        intelligence.service.ts
StockMovement,                 python -m jobs.train_all            getDemandForecast,
AuditLog, User…                 ├ kpi_snapshots                    getRestockSuggestions,
                                ├ forecast_demand                  getCustomerSegments…
                                ├ restock                                │
                                ├ customer_rfm                          ▼
                                ├ market_basket          ──escribe──► tablas derivadas
                                ├ fraud_detection                   (DemandForecast, RiskScore…)
                                └ account_takeover                  + ModelRun (trazabilidad)
```

1. **La operación genera los datos.** No hay un *data warehouse* aparte: el pipeline lee las
   mismas tablas de la tienda.
2. **El pipeline entrena por lotes** en GitHub Actions
   ([ml-train.yml](../../.github/workflows/ml-train.yml)), con la conexión directa a Neon
   (secret `NEON_DIRECT_URL`). Cada job borra sus predicciones anteriores y escribe las nuevas.
3. **Cada corrida queda en `ModelRun`:** modelo, versión, estado, métricas, filas leídas y
   escritas, y duración. Cada predicción apunta a la corrida que la generó, de modo que se
   puede responder qué modelo y qué versión produjeron un número. La vista **Modelos** muestra
   esa trazabilidad.
4. **La trastienda solo lee** con
   [intelligence.service.ts](../../src/lib/services/intelligence.service.ts). Ese archivo
   empieza con una tabla que asocia cada job de Python a su función de lectura.

Si un modelo todavía no tiene datos, la vista muestra `IntelligencePlaceholder`, que explica
qué falta, en vez de una tabla vacía o un error.

## Qué es ML y qué es BI

| Vista | Precalculado en Python (pipeline diario) | Calculado en vivo en TypeScript |
|---|---|---|
| Métricas | KPI por mes, categoría, producto y comuna (`kpi_snapshots`, agregación) | Clasificación ABC, anomalías de ventas (z-score ≥ 2,5) y alertas |
| Demanda | Forecast Ridge a 3 meses con banda y backtest | Productos en alza o en baja, ganancia esperada, **elasticidad-precio** |
| Qué reponer | Sugerencia de compra y días hasta el quiebre | Mermas y sobre-stock |
| Logística | — | Ventas y costo de envío por región, SLA por courier |
| Recomendaciones | Reglas de asociación (lift) y packs | — |
| Clientes | Segmentación RFM + KMeans | Valor de vida del cliente (CLV), recompra y fuga |
| Conversión | — | Embudo, carritos abandonados, búsquedas sin resultado |
| Riesgo | Isolation Forest en órdenes; account takeover (reglas y umbrales sobre la bitácora) | Analítica de incidentes (MTTR y otros) |
| Modelos | Historial de corridas y tasa de éxito | — |
| Reporte | Resumen ejecutivo imprimible que combina todo lo anterior | |

**El BI en vivo usa la misma definición de venta que el ML:** pagada y no cancelada
(`SALE_WHERE` / `SALE_SQL` en [sales.ts](../../src/lib/sales.ts)). Los días y meses se agrupan
en hora de Chile.

## Alertas de Métricas

`getAlerts` revisa en cada carga y enlaza cada alerta a la sección exacta donde se resuelve:

| Nivel | Alerta | Lleva a |
|---|---|---|
| Crítica | Pagos que hay que reembolsar | Cola de reembolsos |
| Crítica | Incidentes de seguridad críticos sin resolver | Seguridad → incidencias |
| Crítica | Cuentas posiblemente comprometidas | Riesgo → cuentas |
| Atención | Solicitudes de cambio o devolución por revisar | Devoluciones pendientes |
| Atención | Retiros en tienda vencidos | Pedidos enviados con retiro |
| Atención | Cuentas con intentos de fuerza bruta | Riesgo → cuentas |
| Atención | Productos que se agotan antes de que llegue el proveedor | Qué reponer |
| Atención | Productos en o bajo el umbral de stock | Inventario con stock bajo |
| Informativa | Órdenes por despachar marcadas para revisión de fraude | Riesgo → órdenes |

## Elasticidad-precio

[elasticity.service.ts](../../src/lib/services/elasticity.service.ts) no es un modelo
entrenado: es una medida descriptiva que se calcula en vivo.

1. Por cada cambio en `PriceHistory`, compara las **ventas válidas por día** en los 28 días
   anteriores y en los 28 posteriores. Las ventanas se cortan en el cambio de precio anterior o
   en el siguiente, para no mezclar efectos.
2. Calcula la **elasticidad de arco**: la variación porcentual de las ventas dividida por la
   variación porcentual del precio, ambas medidas sobre el punto medio.
3. Clasifica el resultado:
   - **elástica** si |e| > 1,1;
   - **inelástica** si |e| < 0,9;
   - **unitaria** entre ambos valores;
   - **atípica** si e > 0,05, porque las ventas se movieron en el mismo sentido que el precio.
4. **No publica una cifra sin evidencia.**
   - Si una ventana tiene menos de 14 días, el cambio queda **en observación**.
   - Si entre ambas ventanas se vendieron menos de 10 unidades, queda **sin datos suficientes**.

Se ve en dos lugares: debajo de cada cambio de precio, en la ficha del producto, y como tabla
general en **Demanda**. Las pruebas están en
[elasticity.test.ts](../../tests/unit/elasticity.test.ts).
