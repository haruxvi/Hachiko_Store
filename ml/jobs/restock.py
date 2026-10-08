"""Fase 2 — Sugerencia de reposición ("qué comprar y cuánto").

Combina el forecast de demanda del mes en curso (DemandForecast) con el stock
DISPONIBLE (físico menos reservas vigentes) y un lead time de proveedor para
estimar, por producto:
  - días hasta el quiebre de stock,
  - cantidad sugerida a comprar para cubrir lead time + un periodo de holgura.
Escribe RestockSuggestion. Debe correr DESPUÉS de forecast_demand.

Urgencia (score 0..1): baja en línea recta a medida que quedan más días de
stock; 1 = ya no hay stock, 0 = alcanza para todo el lead time + la holgura.
Es "urgente" cuando el stock se acaba ANTES de que llegue un pedido nuevo al
proveedor (días hasta el quiebre <= lead time). Antes el score se saturaba en 1
para casi todo y no permitía ordenar las prioridades.

Ejecutar (desde ml/):  python -m jobs.restock
"""

from __future__ import annotations

import math

from ml.db import read_sql, replace_rows
from ml.model_run import model_run

LEAD_TIME_DAYS = 14   # días que tarda el proveedor en reponer
COVERAGE_DAYS = 30    # días de demanda que se quiere tener cubiertos
HORIZON_DAYS = LEAD_TIME_DAYS + COVERAGE_DAYS

INSERT_SQL = (
    'INSERT INTO "RestockSuggestion" '
    '(id, "productId", "suggestedQty", reason, "daysToStockout", score, "modelRunId") '
    'VALUES (:id, :pid, :qty, :reason, :dts, :score, :run)'
)


def main() -> None:
    with model_run("restock", "1.1.0", notes="Fase 2 — reposición desde forecast") as run:
        # Forecast del periodo más próximo por producto + reservas vigentes
        df = read_sql(
            '''SELECT DISTINCT ON (f."productId")
                      f."productId" AS product_id, f."predictedQty" AS pred,
                      f."horizonDays" AS days, p.stock AS stock,
                      COALESCE((SELECT SUM(r.quantity) FROM "StockReservation" r
                                WHERE r."productId" = p.id AND r."expiresAt" > now()), 0) AS reserved
               FROM "DemandForecast" f
               JOIN "Product" p ON p.id = f."productId"
               WHERE p.active = true AND p."archivedAt" IS NULL
               ORDER BY f."productId", f."periodStart" ASC'''
        )
        run.set_rows_in(len(df))
        if df.empty:
            print("Sin forecast disponible — corre forecast_demand primero.")
            return

        rows: list[dict] = []
        seq = 0
        for r in df.itertuples(index=False):
            available = max(0, int(r.stock) - int(r.reserved))
            daily = float(r.pred) / max(1, int(r.days))
            dts = int(available / daily) if daily > 0 else 999
            needed = math.ceil(daily * HORIZON_DAYS)
            qty = max(0, needed - available)
            if qty <= 0:
                continue
            score = round(max(0.0, min(1.0, 1 - dts / HORIZON_DAYS)), 4)
            seq += 1
            rows.append({
                "id": f"rs_{run.id[:8]}_{seq}", "pid": r.product_id, "qty": qty,
                "reason": f"Se venden ~{daily:.1f} uds/día; con {available} disponibles alcanza para "
                          f"{dts} días. Cubre {LEAD_TIME_DAYS}d de proveedor + {COVERAGE_DAYS}d de venta.",
                "dts": dts, "score": score, "run": run.id,
            })

        replace_rows('DELETE FROM "RestockSuggestion"', INSERT_SQL, rows)

        urgent = sum(1 for x in rows if x["dts"] <= LEAD_TIME_DAYS)
        run.set_metrics({"sugerencias": len(rows), "urgentes": urgent,
                         "lead_time_dias": LEAD_TIME_DAYS, "cobertura_dias": COVERAGE_DAYS})
        print(f"RestockSuggestion: {len(rows)} productos a reponer ({urgent} urgentes).")


if __name__ == "__main__":
    main()
