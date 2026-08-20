"""Fase 2 — Sugerencia de reposición ("qué comprar y cuánto").

Combina el forecast de demanda del próximo mes (DemandForecast) con el stock
actual y un lead time de proveedor para estimar, por producto:
  - días hasta el quiebre de stock,
  - cantidad sugerida a comprar para cubrir lead time + un periodo de holgura.
Escribe RestockSuggestion, priorizada por urgencia. Debe correr DESPUÉS de
forecast_demand.

Ejecutar (desde ml/):  python -m jobs.restock
"""

from __future__ import annotations

import math

from ml.db import execute, execute_many, read_sql
from ml.model_run import model_run

LEAD_TIME_DAYS = 14   # días que tarda el proveedor en reponer
COVERAGE_DAYS = 30    # días de demanda que se quiere tener cubiertos

INSERT_SQL = (
    'INSERT INTO "RestockSuggestion" '
    '(id, "productId", "suggestedQty", reason, "daysToStockout", score, "modelRunId") '
    'VALUES (:id, :pid, :qty, :reason, :dts, :score, :run)'
)


def main() -> None:
    with model_run("restock", "1.0.0", notes="Fase 2 — reposición desde forecast") as run:
        # Toma el forecast del periodo más próximo por producto
        df = read_sql(
            '''SELECT DISTINCT ON (f."productId")
                      f."productId" AS product_id, f."predictedQty" AS pred,
                      f."horizonDays" AS days, p.stock AS stock, p.name AS name
               FROM "DemandForecast" f
               JOIN "Product" p ON p.id = f."productId"
               WHERE p.active = true
               ORDER BY f."productId", f."periodStart" ASC'''
        )
        run.set_rows_in(len(df))
        if df.empty:
            print("Sin forecast disponible — corre forecast_demand primero.")
            return

        rows: list[dict] = []
        seq = 0
        for r in df.itertuples(index=False):
            daily = float(r.pred) / max(1, int(r.days))
            dts = int(r.stock / daily) if daily > 0 else 999
            needed = math.ceil(daily * (LEAD_TIME_DAYS + COVERAGE_DAYS))
            qty = max(0, needed - int(r.stock))
            if qty <= 0:
                continue
            # Urgencia: más alta mientras menos días de cobertura queden vs lead time
            score = round(min(1.0, LEAD_TIME_DAYS / (dts + 1)), 4)
            seq += 1
            rows.append({
                "id": f"rs_{run.id[:8]}_{seq}", "pid": r.product_id, "qty": qty,
                "reason": f"Cubre {LEAD_TIME_DAYS}d de lead time + {COVERAGE_DAYS}d de demanda "
                          f"(~{daily:.1f} uds/día); stock actual {int(r.stock)}.",
                "dts": dts, "score": score, "run": run.id,
            })

        execute('DELETE FROM "RestockSuggestion"')
        execute_many(INSERT_SQL, rows)

        urgent = sum(1 for x in rows if x["score"] >= 0.5)
        run.set_metrics({"sugerencias": len(rows), "urgentes": urgent,
                         "lead_time_dias": LEAD_TIME_DAYS, "cobertura_dias": COVERAGE_DAYS})
        print(f"RestockSuggestion: {len(rows)} productos a reponer ({urgent} urgentes).")


if __name__ == "__main__":
    main()
