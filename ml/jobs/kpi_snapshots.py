"""Fase 1 — Analítica descriptiva. Calcula KPIs y los escribe en KpiSnapshot.

Genera (sobre órdenes PAGADAS):
  - Serie temporal mensual y anual (dimension=_all): revenue, orders, units, margin
  - Desglose por categoría (dimension=category): revenue, margin
  - Desglose por producto (dimension=product): revenue, units, margin  → ABC + margen
  - Desglose por comuna (dimension=commune): revenue, orders  → mapa de ventas

Es un refresh completo e idempotente: borra KpiSnapshot y reinserta. Cada fila
queda etiquetada con el modelRunId de la corrida (trazabilidad).

Ejecutar (desde ml/):  python -m jobs.kpi_snapshots
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd

from ml.db import execute, execute_many, read_sql
from ml.model_run import model_run

INSERT_SQL = (
    'INSERT INTO "KpiSnapshot" '
    '(id, "periodType", "periodStart", metric, value, dimension, "dimensionId", "modelRunId") '
    'VALUES (:id, CAST(:pt AS "KpiPeriod"), :ps, :metric, :value, :dim, :dim_id, :run)'
)

# Fecha de referencia para los desgloses dimensionales (no son serie temporal).
REF = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

_seq = 0


def _rows_from(df: pd.DataFrame, period_type: str, period_col, dim: str,
               dim_col, metrics: dict[str, str], run_id: str) -> list[dict]:
    """Convierte un DataFrame agregado en filas de KpiSnapshot."""
    global _seq
    out: list[dict] = []
    for _, r in df.iterrows():
        ps = REF if period_col is None else r[period_col].to_pydatetime()
        dim_id = "_all" if dim_col is None else str(r[dim_col])
        for metric, col in metrics.items():
            _seq += 1
            out.append({
                "id": f"kpi_{run_id[:8]}_{_seq}",
                "pt": period_type, "ps": ps, "metric": metric,
                "value": float(r[col]), "dim": dim, "dim_id": dim_id, "run": run_id,
            })
    return out


def main() -> None:
    with model_run("kpi_snapshots", "1.0.0", notes="Fase 1 — KPIs descriptivos") as run:
        df = read_sql(
            '''SELECT oi."orderId" AS order_id, o."createdAt" AS created_at,
                      o."shippingCommune" AS commune, c.name AS category,
                      p.id AS product_id, oi.quantity AS qty,
                      oi."unitPriceCLP" AS unit_price, COALESCE(p."costCLP", 0) AS cost
               FROM "OrderItem" oi
               JOIN "Order" o     ON o.id = oi."orderId"
               JOIN "Product" p   ON p.id = oi."productId"
               JOIN "Category" c  ON c.id = p."categoryId"
               WHERE o."paymentStatus" = 'PAID' '''
        )
        run.set_rows_in(len(df))
        if df.empty:
            print("Sin órdenes pagadas — nada que calcular.")
            return

        df["revenue"] = df["unit_price"] * df["qty"]
        df["margin"] = (df["unit_price"] - df["cost"]) * df["qty"]
        df["month"] = df["created_at"].dt.to_period("M").dt.to_timestamp()
        df["year"] = df["created_at"].dt.to_period("Y").dt.to_timestamp()

        agg_time = {"revenue": ("revenue", "sum"), "units": ("qty", "sum"),
                    "margin": ("margin", "sum"), "orders": ("order_id", "nunique")}

        monthly = df.groupby("month").agg(**agg_time).reset_index()
        yearly = df.groupby("year").agg(**agg_time).reset_index()
        by_cat = df.groupby("category").agg(revenue=("revenue", "sum"), margin=("margin", "sum")).reset_index()
        by_prod = df.groupby("product_id").agg(
            revenue=("revenue", "sum"), units=("qty", "sum"), margin=("margin", "sum")
        ).reset_index()
        by_comm = df[df["commune"].notna()].groupby("commune").agg(
            revenue=("revenue", "sum"), orders=("order_id", "nunique")
        ).reset_index()

        tm = {"revenue": "revenue", "orders": "orders", "units": "units", "margin": "margin"}
        rows: list[dict] = []
        rows += _rows_from(monthly, "MONTH", "month", "_all", None, tm, run.id)
        rows += _rows_from(yearly, "YEAR", "year", "_all", None, tm, run.id)
        rows += _rows_from(by_cat, "YEAR", None, "category", "category",
                           {"revenue": "revenue", "margin": "margin"}, run.id)
        rows += _rows_from(by_prod, "YEAR", None, "product", "product_id",
                           {"revenue": "revenue", "units": "units", "margin": "margin"}, run.id)
        rows += _rows_from(by_comm, "YEAR", None, "commune", "commune",
                           {"revenue": "revenue", "orders": "orders"}, run.id)

        # Refresh completo (idempotente)
        execute('DELETE FROM "KpiSnapshot"')
        execute_many(INSERT_SQL, rows)

        run.set_metrics({
            "meses": len(monthly), "categorias": len(by_cat),
            "productos": len(by_prod), "comunas": len(by_comm), "filas_kpi": len(rows),
        })
        print(f"KpiSnapshot actualizado: {len(rows)} filas "
              f"({len(monthly)} meses, {len(by_cat)} categorías, "
              f"{len(by_prod)} productos, {len(by_comm)} comunas).")


if __name__ == "__main__":
    main()
