"""Fase 3 — Detección de fraude / anomalías en órdenes (ML no supervisado).

Ajusta un Isolation Forest sobre features de cada orden y marca los pedidos
atípicos que merecen revisión manual. Escribe RiskScore (subjectType=ORDER), con
un score 0..1 y las señales que lo dispararon (explicabilidad). No decide por
sí solo: es apoyo a revisión humana.

Features (por orden):
  - monto (en log: los montos son muy asimétricos), n.º de líneas y de unidades
  - hora del día en hora de Chile, codificada como círculo (sen/cos: las 23:00
    y las 00:00 están cerca, no en extremos opuestos)
  - invitado, retiro en tienda
  - antigüedad de la cuenta al comprar y n.º de compras previas del cliente
    (una cuenta recién creada que hace un pedido grande es la señal clásica)

No se usa el "precio medio por unidad": solo indicaba que la orden traía un
producto caro (p. ej. un lightstick), no que fuera sospechosa.

El modelo aprende de TODA la historia, pero solo se marcan para revisión las
órdenes que aún se pueden detener: pagadas, sin despachar y de los últimos
RECENT_DAYS días. Marcar pedidos entregados hace meses no sirve para actuar.

Ejecutar (desde ml/):  python -m jobs.fraud_detection
"""

from __future__ import annotations

import os

os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))

import json

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from ml.db import read_sql, replace_rows, to_local
from ml.model_run import model_run

CONTAMINATION = 0.02  # proporción esperada de anomalías en la historia
RECENT_DAYS = 30

INSERT_SQL = (
    'INSERT INTO "RiskScore" '
    '(id, "subjectType", "subjectId", score, reasons, "modelRunId") '
    'VALUES (:id, CAST(:st AS "RiskSubject"), :sid, :score, CAST(:reasons AS jsonb), :run)'
)


def _reasons(row: dict, stats: pd.DataFrame) -> list[str]:
    """Señales explicables: qué tiene de raro este pedido."""
    out: list[str] = []

    def z(col: str) -> float:
        return (row[col] - stats.loc[col, "mean"]) / (stats.loc[col, "std"] or 1)

    if z("log_total") >= 2.5:
        out.append("monto inusualmente alto")
    if z("n_units") >= 2.5:
        out.append("cantidad de unidades atípica")
    if row["account_age_days"] < 1 and row["prior_orders"] == 0 and z("log_total") >= 1.5:
        out.append("cuenta recién creada con una primera compra grande")
    if row["is_guest"] and z("log_total") >= 1.5:
        out.append("compra como invitado con monto elevado")
    if 1 <= row["hour"] <= 5:
        out.append("pedido de madrugada (hora de Chile)")
    return out or ["combinación de rasgos poco habitual"]


def main() -> None:
    with model_run("fraud", "1.1.0", notes="Fase 3 — Isolation Forest en órdenes") as run:
        df = read_sql(
            f'''SELECT o.id AS order_id, o."totalCLP" AS total, o."createdAt" AS created_at,
                      o."shippingMethod" AS method, o.status AS status, o."paymentStatus" AS payment,
                      u."isGuest" AS is_guest,
                      EXTRACT(EPOCH FROM (o."createdAt" - u."createdAt")) / 86400 AS account_age_days,
                      ROW_NUMBER() OVER (PARTITION BY o."userId" ORDER BY o."createdAt") - 1 AS prior_orders,
                      (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."orderId" = o.id) AS n_items,
                      (SELECT COALESCE(SUM(oi.quantity), 0) FROM "OrderItem" oi WHERE oi."orderId" = o.id) AS n_units,
                      o."createdAt" >= now() - make_interval(days => {int(RECENT_DAYS)}) AS is_recent
               FROM "Order" o
               JOIN "User" u ON u.id = o."userId"'''
        )
        run.set_rows_in(len(df))
        if len(df) < 50:
            print("Muy pocas órdenes para detectar anomalías.")
            return

        df["hour"] = to_local(df["created_at"]).dt.hour
        df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
        df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
        df["is_guest"] = df["is_guest"].astype(int)
        df["is_pickup"] = (df["method"] == "PICKUP").astype(int)
        df["log_total"] = np.log1p(df["total"].astype(float))
        df["account_age_days"] = df["account_age_days"].astype(float).clip(lower=0)
        df["log_age"] = np.log1p(df["account_age_days"])
        df["log_prior"] = np.log1p(df["prior_orders"].astype(float))

        feats = ["log_total", "n_items", "n_units", "hour_sin", "hour_cos",
                 "is_guest", "is_pickup", "log_age", "log_prior"]
        X = df[feats].to_numpy(dtype=float)

        model = IsolationForest(contamination=CONTAMINATION, random_state=42, n_estimators=200)
        model.fit(X)
        raw = model.decision_function(X)           # mayor = más normal
        df["flag"] = model.predict(X) == -1        # -1 = anomalía
        df["risk"] = (raw.max() - raw) / (raw.max() - raw.min() or 1)  # 0..1, mayor = más riesgo

        actionable = (df["is_recent"].astype(bool) & (df["payment"] == "PAID")
                      & df["status"].isin(["PAID", "PREPARING"]))
        stats = df[["log_total", "n_units"]].agg(["mean", "std"]).T
        flagged = df[df["flag"] & actionable].sort_values("risk", ascending=False)

        rows = [{
            "id": f"risk_{run.id[:8]}_{i}", "st": "ORDER", "sid": r["order_id"],
            "score": round(float(r["risk"]), 4),
            "reasons": json.dumps(_reasons(r, stats), ensure_ascii=False),
            "run": run.id,
        } for i, r in enumerate(flagged.to_dict("records"))]

        replace_rows('DELETE FROM "RiskScore" WHERE "subjectType" = \'ORDER\'', INSERT_SQL, rows)

        run.set_metrics({"ordenes": len(df), "revisables": int(actionable.sum()),
                         "marcadas": len(rows), "contaminacion": CONTAMINATION,
                         "ventana_dias": RECENT_DAYS})
        print(f"RiskScore: {len(rows)} órdenes para revisar (de {int(actionable.sum())} "
              f"pagadas sin despachar en {RECENT_DAYS} días; modelo entrenado con {len(df)}).")


if __name__ == "__main__":
    main()
