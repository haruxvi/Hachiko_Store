"""Fase 2 — Forecast de demanda por producto (ML supervisado).

Para cada producto ajusta una regresión Ridge con features de calendario
(mes-del-año one-hot) + tendencia lineal, sobre la serie mensual de unidades
vendidas. Predice los próximos 3 meses con banda de incertidumbre y escribe
DemandForecast. Es explicable (los coeficientes por mes son los índices
estacionales) y liviano — sin dependencias pesadas.

Ejecutar (desde ml/):  python -m jobs.forecast_demand
"""

from __future__ import annotations

import calendar

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from ml.db import execute, execute_many, read_sql
from ml.model_run import model_run

HORIZON = 3  # meses a predecir

INSERT_SQL = (
    'INSERT INTO "DemandForecast" '
    '(id, "productId", "periodStart", "horizonDays", "predictedQty", "lowerQty", "upperQty", "modelRunId") '
    'VALUES (:id, :pid, :ps, :hd, :pq, :lo, :hi, :run)'
)


def _design(months: pd.DatetimeIndex, origin: pd.Timestamp) -> np.ndarray:
    """Matriz de diseño: tendencia (meses desde el origen) + one-hot de mes."""
    trend = np.array([(m.year - origin.year) * 12 + (m.month - origin.month) for m in months], dtype=float)
    onehot = np.zeros((len(months), 11))  # meses 2..12 (enero es la base)
    for i, m in enumerate(months):
        if m.month >= 2:
            onehot[i, m.month - 2] = 1.0
    return np.column_stack([trend, onehot])


def main() -> None:
    with model_run("demand_forecast", "1.0.0", notes="Fase 2 — forecast Ridge estacional") as run:
        df = read_sql(
            '''SELECT p.id AS product_id,
                      date_trunc('month', o."createdAt") AS month,
                      SUM(oi.quantity) AS units
               FROM "OrderItem" oi
               JOIN "Order" o   ON o.id = oi."orderId"
               JOIN "Product" p ON p.id = oi."productId"
               WHERE o."paymentStatus" = 'PAID'
               GROUP BY 1, 2'''
        )
        run.set_rows_in(len(df))
        if df.empty:
            print("Sin ventas — no se puede pronosticar.")
            return

        df["month"] = pd.to_datetime(df["month"]).dt.tz_localize(None)
        full = pd.date_range(df["month"].min(), df["month"].max(), freq="MS")
        origin = full[0]
        future = pd.date_range(full[-1] + pd.offsets.MonthBegin(1), periods=HORIZON, freq="MS")

        rows: list[dict] = []
        maes: list[float] = []
        seq = 0
        for pid, g in df.groupby("product_id"):
            serie = g.set_index("month")["units"].reindex(full, fill_value=0).astype(float)
            X, y = _design(full, origin), serie.to_numpy()
            model = Ridge(alpha=1.0)
            model.fit(X, y)
            resid = y - model.predict(X)
            maes.append(float(np.mean(np.abs(resid))))
            sigma = float(np.std(resid))

            preds = model.predict(_design(future, origin))
            for m, p in zip(future, preds):
                seq += 1
                q = max(0, round(float(p)))
                days = calendar.monthrange(m.year, m.month)[1]
                rows.append({
                    "id": f"df_{run.id[:8]}_{seq}", "pid": pid, "ps": m.to_pydatetime(),
                    "hd": days, "pq": q,
                    "lo": max(0, round(float(p - 1.28 * sigma))),
                    "hi": round(float(p + 1.28 * sigma)), "run": run.id,
                })

        execute('DELETE FROM "DemandForecast"')
        execute_many(INSERT_SQL, rows)

        run.set_metrics({"productos": int(df["product_id"].nunique()),
                         "horizonte_meses": HORIZON, "mae_promedio": round(float(np.mean(maes)), 2)})
        print(f"DemandForecast: {len(rows)} predicciones para {df['product_id'].nunique()} "
              f"productos · MAE promedio {np.mean(maes):.2f} uds/mes.")


if __name__ == "__main__":
    main()
