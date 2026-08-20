"""Fase 2 — Segmentación de clientes RFM + clustering KMeans (ML).

Calcula Recencia, Frecuencia y Monto por cliente (sobre órdenes pagadas),
asigna scores por quintiles (1–5), un segmento nombrado según la grilla RFM
clásica, y un clusterId de KMeans sobre las tres dimensiones escaladas.
Escribe CustomerSegment. Solo opera sobre clientes con órdenes pagadas.

Privacidad (Ley 21.719): trabaja con userId, sin PII (email/teléfono).

Ejecutar (desde ml/):  python -m jobs.customer_rfm
"""

from __future__ import annotations

import os

# joblib no logra contar cores físicos en Windows sin wmic; fijamos el máximo
# para silenciar el warning. Debe ir antes de importar sklearn.
os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from ml.db import execute, execute_many, read_sql
from ml.model_run import model_run

INSERT_SQL = (
    'INSERT INTO "CustomerSegment" '
    '(id, "userId", segment, "rScore", "fScore", "mScore", "clusterId", "modelRunId") '
    'VALUES (:id, :uid, :seg, :r, :f, :m, :cl, :run)'
)


def _quintile(s: pd.Series, invert: bool = False) -> pd.Series:
    """Score 1–5 por quintiles. invert=True para recencia (menos días = mejor)."""
    try:
        q = pd.qcut(s.rank(method="first"), 5, labels=[1, 2, 3, 4, 5]).astype(int)
    except ValueError:
        q = pd.Series(3, index=s.index)  # sin variabilidad suficiente
    return (6 - q) if invert else q


def _segment(r: int, f: int) -> str:
    if r >= 4 and f >= 4:
        return "champions"
    if r >= 3 and f >= 3:
        return "leales"
    if r >= 4 and f <= 2:
        return "nuevos"
    if r <= 2 and f >= 3:
        return "en_riesgo"
    if r <= 2 and f <= 2:
        return "hibernando"
    return "prometedores"


def main() -> None:
    with model_run("rfm", "1.0.0", notes="Fase 2 — RFM + KMeans") as run:
        df = read_sql(
            '''SELECT o."userId" AS user_id,
                      MAX(o."createdAt") AS last_order,
                      COUNT(*) AS frequency,
                      SUM(o."totalCLP") AS monetary
               FROM "Order" o
               WHERE o."paymentStatus" = 'PAID'
               GROUP BY 1'''
        )
        run.set_rows_in(len(df))
        if len(df) < 5:
            print("Muy pocos clientes con compras — nada que segmentar.")
            return

        now = pd.Timestamp.now(tz="UTC").tz_localize(None)
        df["recency"] = (now - pd.to_datetime(df["last_order"]).dt.tz_localize(None)).dt.days
        df["r"] = _quintile(df["recency"], invert=True)
        df["f"] = _quintile(df["frequency"])
        df["m"] = _quintile(df["monetary"])
        df["segment"] = [_segment(r, f) for r, f in zip(df["r"], df["f"])]

        # KMeans sobre RFM escalado (4 clusters)
        X = StandardScaler().fit_transform(df[["recency", "frequency", "monetary"]].to_numpy())
        k = min(4, len(df))
        km = KMeans(n_clusters=k, random_state=42, n_init=10).fit(X)
        df["cluster"] = km.labels_
        sil = float(silhouette_score(X, km.labels_)) if k > 1 else 0.0

        rows = [{
            "id": f"seg_{run.id[:8]}_{i}", "uid": row.user_id, "seg": row.segment,
            "r": int(row.r), "f": int(row.f), "m": int(row.m),
            "cl": int(row.cluster), "run": run.id,
        } for i, row in enumerate(df.itertuples(index=False))]

        execute('DELETE FROM "CustomerSegment"')
        execute_many(INSERT_SQL, rows)

        dist = df["segment"].value_counts().to_dict()
        run.set_metrics({"clientes": len(df), "clusters": k,
                         "silhouette": round(sil, 3), "distribucion": dist})
        print(f"CustomerSegment: {len(df)} clientes · {k} clusters "
              f"(silhouette {sil:.3f}) · {dist}")


if __name__ == "__main__":
    main()
