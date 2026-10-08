"""Fase 2 — Forecast de demanda por producto (ML supervisado).

Para cada producto ajusta una regresión Ridge con features de calendario
(mes-del-año one-hot) + tendencia lineal, sobre la serie mensual de unidades
vendidas. Predice los próximos 3 meses con banda de incertidumbre y escribe
DemandForecast. Es explicable (los coeficientes por mes son los índices
estacionales) y liviano — sin dependencias pesadas.

Evaluación honesta (backtest): antes de pronosticar, se entrena SIN los últimos
3 meses cerrados, se predicen esos 3 meses y se mide el error contra lo que de
verdad se vendió. Se compara con un modelo ingenuo ("lo mismo que el mismo mes
del año pasado"). El error sobre los datos de entrenamiento no sirve para esto:
siempre sale optimista.

Solo usa meses cerrados (hora de Chile): el mes en curso está incompleto y se
vería como una caída de demanda. El pronóstico parte en el mes en curso.

Ejecutar (desde ml/):  python -m jobs.forecast_demand
"""

from __future__ import annotations

import calendar

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from ml.db import SALE_SQL, local_now, read_sql, replace_rows, to_local
from ml.model_run import model_run

HORIZON = 3  # meses a predecir
BACKTEST = 3  # meses reservados para medir el error
MIN_MONTHS_BACKTEST = 15  # historia mínima para que el backtest tenga sentido

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


def _fit(months: pd.DatetimeIndex, y: np.ndarray, origin: pd.Timestamp) -> Ridge:
    return Ridge(alpha=1.0).fit(_design(months, origin), y)


def main() -> None:
    with model_run("demand_forecast", "1.1.0", notes="Fase 2 — forecast Ridge estacional + backtest") as run:
        df = read_sql(
            f'''SELECT oi."productId" AS product_id, o."createdAt" AS created_at, oi.quantity AS units
               FROM "OrderItem" oi
               JOIN "Order" o   ON o.id = oi."orderId"
               JOIN "Product" p ON p.id = oi."productId"
               WHERE {SALE_SQL} AND p.active = true'''
        )
        run.set_rows_in(len(df))

        current_month = local_now().to_period("M").to_timestamp()
        if not df.empty:
            df["month"] = to_local(df["created_at"]).dt.to_period("M").dt.to_timestamp()
            df = df[df["month"] < current_month]
        if df.empty:
            print("Sin ventas en meses cerrados — no se puede pronosticar.")
            return

        monthly = df.groupby(["product_id", "month"])["units"].sum().reset_index()
        last_closed = current_month - pd.offsets.MonthBegin(1)
        full = pd.date_range(monthly["month"].min(), last_closed, freq="MS")
        origin = full[0]
        future = pd.date_range(current_month, periods=HORIZON, freq="MS")
        can_backtest = len(full) >= MIN_MONTHS_BACKTEST

        rows: list[dict] = []
        err_model: list[float] = []
        err_naive: list[float] = []
        seq = 0
        for pid, g in monthly.groupby("product_id"):
            serie = g.set_index("month")["units"].reindex(full, fill_value=0).astype(float)
            y = serie.to_numpy()

            if can_backtest:
                train_m, test_m = full[:-BACKTEST], full[-BACKTEST:]
                bt = _fit(train_m, y[:-BACKTEST], origin)
                pred = np.clip(bt.predict(_design(test_m, origin)), 0, None)
                real = y[-BACKTEST:]
                err_model.extend(np.abs(pred - real))
                # Ingenuo estacional: lo vendido el mismo mes del año anterior.
                err_naive.extend(np.abs(y[-BACKTEST - 12:-12] - real))

            model = _fit(full, y, origin)
            sigma = float(np.std(y - model.predict(_design(full, origin))))
            for m, p in zip(future, model.predict(_design(future, origin))):
                seq += 1
                rows.append({
                    "id": f"df_{run.id[:8]}_{seq}", "pid": pid, "ps": m.to_pydatetime(),
                    "hd": calendar.monthrange(m.year, m.month)[1], "pq": max(0, round(float(p))),
                    "lo": max(0, round(float(p - 1.28 * sigma))),
                    "hi": max(0, round(float(p + 1.28 * sigma))), "run": run.id,
                })

        replace_rows('DELETE FROM "DemandForecast"', INSERT_SQL, rows)

        metrics: dict = {"productos": int(monthly["product_id"].nunique()),
                         "horizonte_meses": HORIZON, "meses_historia": len(full)}
        if can_backtest:
            metrics["mae_promedio"] = round(float(np.mean(err_model)), 2)
            metrics["mae_ingenuo"] = round(float(np.mean(err_naive)), 2)
            metrics["meses_backtest"] = BACKTEST
        run.set_metrics(metrics)
        bt_txt = (f"MAE backtest {metrics['mae_promedio']} uds/mes "
                  f"(ingenuo {metrics['mae_ingenuo']})") if can_backtest else "sin historia para backtest"
        print(f"DemandForecast: {len(rows)} predicciones para {metrics['productos']} productos · {bt_txt}.")


if __name__ == "__main__":
    main()
