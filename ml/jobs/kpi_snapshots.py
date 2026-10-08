"""Fase 1 — Analítica descriptiva. Calcula KPIs y los escribe en KpiSnapshot.

Genera (sobre ventas válidas: pagadas y no canceladas):
  - Serie temporal mensual y anual (dimension=_all): revenue, orders, units, margin
  - Desglose por categoría (dimension=category): revenue, margin
  - Desglose por producto (dimension=product): revenue, units, margin  → ABC + margen
  - Desglose por comuna (dimension=commune): revenue, orders  → mapa de ventas

Decisiones para que las cifras sean comparables entre vistas:
  - Ingresos = venta de productos (precio × cantidad), sin el envío.
  - Solo meses CERRADOS en hora de Chile: el mes en curso, incompleto, se
    vería como una caída falsa.
  - Los desgloses (categoría, producto, comuna) usan la MISMA ventana que las
    tarjetas del panel: los últimos 12 meses cerrados.
  - El margen solo se calcula donde el producto tiene costo. Se guarda además
    `costed_revenue` (ingresos con costo conocido) para que el % de margen no
    trate un costo faltante como costo cero (margen 100% falso).

Es un refresh completo e idempotente: borra KpiSnapshot y reinserta en una sola
transacción. Cada fila queda etiquetada con el modelRunId de la corrida.

Ejecutar (desde ml/):  python -m jobs.kpi_snapshots
"""

from __future__ import annotations

import pandas as pd

from ml.db import SALE_SQL, local_now, read_sql, replace_rows, to_local
from ml.model_run import model_run

INSERT_SQL = (
    'INSERT INTO "KpiSnapshot" '
    '(id, "periodType", "periodStart", metric, value, dimension, "dimensionId", "modelRunId") '
    'VALUES (:id, CAST(:pt AS "KpiPeriod"), :ps, :metric, :value, :dim, :dim_id, :run)'
)

WINDOW_MONTHS = 12


def _rows_from(df: pd.DataFrame, period_type: str, period_col, ref, dim: str,
               dim_col, metrics: dict[str, str], run_id: str, seq: list[int]) -> list[dict]:
    """Convierte un DataFrame agregado en filas de KpiSnapshot."""
    out: list[dict] = []
    for _, r in df.iterrows():
        ps = ref if period_col is None else r[period_col].to_pydatetime()
        dim_id = "_all" if dim_col is None else str(r[dim_col])
        for metric, col in metrics.items():
            seq[0] += 1
            out.append({
                "id": f"kpi_{run_id[:8]}_{seq[0]}",
                "pt": period_type, "ps": ps, "metric": metric,
                "value": float(r[col]), "dim": dim, "dim_id": dim_id, "run": run_id,
            })
    return out


def main() -> None:
    with model_run("kpi_snapshots", "1.1.0", notes="Fase 1 — KPIs descriptivos") as run:
        df = read_sql(
            f'''SELECT oi."orderId" AS order_id, o."createdAt" AS created_at,
                      o."shippingCommune" AS commune, c.name AS category,
                      p.id AS product_id, oi.quantity AS qty,
                      oi."unitPriceCLP" AS unit_price, p."costCLP" AS cost
               FROM "OrderItem" oi
               JOIN "Order" o     ON o.id = oi."orderId"
               JOIN "Product" p   ON p.id = oi."productId"
               JOIN "Category" c  ON c.id = p."categoryId"
               WHERE {SALE_SQL}'''
        )
        run.set_rows_in(len(df))

        current_month = local_now().to_period("M").to_timestamp()
        if not df.empty:
            df["local"] = to_local(df["created_at"])
            df["month"] = df["local"].dt.to_period("M").dt.to_timestamp()
            df = df[df["month"] < current_month]
        if df.empty:
            print("Sin ventas en meses cerrados — nada que calcular.")
            return

        df["revenue"] = df["unit_price"] * df["qty"]
        has_cost = df["cost"].notna()
        df["costed_revenue"] = df["revenue"].where(has_cost, 0)
        df["margin"] = ((df["unit_price"] - df["cost"]) * df["qty"]).where(has_cost, 0)
        df["year"] = df["local"].dt.to_period("Y").dt.to_timestamp()

        agg_time = {"revenue": ("revenue", "sum"), "units": ("qty", "sum"),
                    "margin": ("margin", "sum"), "costed_revenue": ("costed_revenue", "sum"),
                    "orders": ("order_id", "nunique")}
        monthly = df.groupby("month").agg(**agg_time).reset_index()
        yearly = df.groupby("year").agg(**agg_time).reset_index()

        # Ventana de los desgloses = los mismos 12 meses de las tarjetas.
        last_month = monthly["month"].max()
        window_start = last_month - pd.DateOffset(months=WINDOW_MONTHS - 1)
        win = df[df["month"] >= window_start]
        ref = window_start.to_pydatetime()

        money = {"revenue": ("revenue", "sum"), "margin": ("margin", "sum"),
                 "costed_revenue": ("costed_revenue", "sum")}
        by_cat = win.groupby("category").agg(**money).reset_index()
        by_prod = win.groupby("product_id").agg(units=("qty", "sum"), **money).reset_index()
        by_comm = win[win["commune"].notna()].groupby("commune").agg(
            revenue=("revenue", "sum"), orders=("order_id", "nunique")
        ).reset_index()

        seq = [0]
        tm = {"revenue": "revenue", "orders": "orders", "units": "units",
              "margin": "margin", "costed_revenue": "costed_revenue"}
        mm = {"revenue": "revenue", "margin": "margin", "costed_revenue": "costed_revenue"}
        rows: list[dict] = []
        rows += _rows_from(monthly, "MONTH", "month", None, "_all", None, tm, run.id, seq)
        rows += _rows_from(yearly, "YEAR", "year", None, "_all", None, tm, run.id, seq)
        rows += _rows_from(by_cat, "YEAR", None, ref, "category", "category", mm, run.id, seq)
        rows += _rows_from(by_prod, "YEAR", None, ref, "product", "product_id",
                           {**mm, "units": "units"}, run.id, seq)
        rows += _rows_from(by_comm, "YEAR", None, ref, "commune", "commune",
                           {"revenue": "revenue", "orders": "orders"}, run.id, seq)

        replace_rows('DELETE FROM "KpiSnapshot"', INSERT_SQL, rows)

        sin_costo = int(df.loc[~has_cost, "product_id"].nunique())
        run.set_metrics({
            "meses": len(monthly), "categorias": len(by_cat),
            "productos": len(by_prod), "comunas": len(by_comm), "filas_kpi": len(rows),
            "ventana_desde": str(window_start.date()), "productos_sin_costo": sin_costo,
        })
        print(f"KpiSnapshot actualizado: {len(rows)} filas "
              f"({len(monthly)} meses cerrados, {len(by_cat)} categorías, "
              f"{len(by_prod)} productos, {len(by_comm)} comunas; "
              f"{sin_costo} producto(s) sin costo excluidos del margen).")


if __name__ == "__main__":
    main()
