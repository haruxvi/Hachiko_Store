"""Fase 3 — Detección de fraude / anomalías en órdenes (ML no supervisado).

Ajusta un Isolation Forest sobre features de cada orden (monto, nº de ítems,
hora, invitado, retiro, precio medio por unidad) para detectar pedidos
atípicos que merecen revisión manual. Escribe los pedidos marcados en
RiskScore (subjectType=ORDER), con un score 0..1 y las señales que lo
dispararon (explicabilidad). No decide por sí solo: es apoyo a revisión humana.

Ejecutar (desde ml/):  python -m jobs.fraud_detection
"""

from __future__ import annotations

import os

os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))

import json

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from ml.db import execute, execute_many, read_sql
from ml.model_run import model_run

CONTAMINATION = 0.02  # proporción esperada de anomalías

INSERT_SQL = (
    'INSERT INTO "RiskScore" '
    '(id, "subjectType", "subjectId", score, reasons, "modelRunId") '
    'VALUES (:id, CAST(:st AS "RiskSubject"), :sid, :score, CAST(:reasons AS jsonb), :run)'
)


def _reasons(row: pd.Series, stats: pd.DataFrame) -> list[str]:
    """Señales explicables: qué features del pedido son extremas (z-score alto)."""
    out: list[str] = []
    checks = {
        "total": "monto inusualmente alto",
        "n_units": "cantidad de unidades atípica",
        "avg_price": "precio medio por unidad atípico",
    }
    for col, msg in checks.items():
        z = (row[col] - stats.loc[col, "mean"]) / (stats.loc[col, "std"] or 1)
        if z >= 2.5:
            out.append(msg)
    if row["is_guest"] and row["total"] > stats.loc["total", "mean"] * 2:
        out.append("invitado con monto elevado")
    if row["hour"] <= 5:
        out.append("pedido en horario de madrugada")
    return out or ["patrón general atípico"]


def main() -> None:
    with model_run("fraud", "1.0.0", notes="Fase 3 — Isolation Forest en órdenes") as run:
        df = read_sql(
            '''SELECT o.id AS order_id, o."totalCLP" AS total, o."createdAt" AS created_at,
                      o."shippingMethod" AS method, u."isGuest" AS is_guest,
                      COUNT(oi.id) AS n_items, COALESCE(SUM(oi.quantity), 0) AS n_units
               FROM "Order" o
               JOIN "User" u ON u.id = o."userId"
               LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
               GROUP BY o.id, u."isGuest"'''
        )
        run.set_rows_in(len(df))
        if len(df) < 50:
            print("Muy pocas órdenes para detectar anomalías.")
            return

        df["hour"] = pd.to_datetime(df["created_at"]).dt.hour
        df["is_guest"] = df["is_guest"].astype(int)
        df["is_pickup"] = (df["method"] == "PICKUP").astype(int)
        df["avg_price"] = df["total"] / df["n_units"].clip(lower=1)

        feats = ["total", "n_items", "n_units", "hour", "is_guest", "is_pickup", "avg_price"]
        X = df[feats].to_numpy(dtype=float)

        model = IsolationForest(contamination=CONTAMINATION, random_state=42, n_estimators=200)
        model.fit(X)
        raw = model.decision_function(X)           # mayor = más normal
        flag = model.predict(X) == -1              # -1 = anomalía
        # Normaliza a 0..1 (mayor = más riesgo)
        risk = (raw.max() - raw) / (raw.max() - raw.min() or 1)
        df["risk"], df["flag"] = risk, flag

        stats = df[["total", "n_units", "avg_price"]].agg(["mean", "std"]).T
        flagged = df[df["flag"]].sort_values("risk", ascending=False)

        rows = []
        for i, r in enumerate(flagged.to_dict("records")):
            rows.append({
                "id": f"risk_{run.id[:8]}_{i}", "st": "ORDER", "sid": r["order_id"],
                "score": round(float(r["risk"]), 4),
                "reasons": json.dumps(_reasons(pd.Series(r), stats), ensure_ascii=False),
                "run": run.id,
            })

        execute('DELETE FROM "RiskScore" WHERE "subjectType" = \'ORDER\'')
        execute_many(INSERT_SQL, rows)

        run.set_metrics({"ordenes": len(df), "marcadas": len(rows),
                         "contaminacion": CONTAMINATION})
        print(f"RiskScore: {len(rows)} órdenes marcadas para revisión "
              f"(de {len(df)} · {CONTAMINATION:.0%} esperado).")


if __name__ == "__main__":
    main()
