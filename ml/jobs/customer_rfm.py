"""Fase 2 — Segmentación de clientes RFM + clustering KMeans (ML).

Calcula Recencia, Frecuencia y Monto por cliente (sobre ventas válidas), asigna
scores 1–5, un segmento nombrado según la grilla RFM clásica, y un clusterId de
KMeans sobre las tres dimensiones escaladas. Escribe CustomerSegment.

Recencia y Frecuencia usan UMBRALES FIJOS (días y n.º de compras), no
quintiles. Con quintiles el 20% "menos reciente" siempre queda como inactivo
aunque haya comprado hace dos semanas, y los empates se reparten al azar (dos
clientes idénticos terminaban en segmentos distintos). El Monto sí va por
quintiles: es continuo y no tiene un umbral natural.

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

from ml.db import SALE_SQL, read_sql, replace_rows
from ml.model_run import model_run

INSERT_SQL = (
    'INSERT INTO "CustomerSegment" '
    '(id, "userId", segment, "rScore", "fScore", "mScore", "clusterId", "modelRunId") '
    'VALUES (:id, :uid, :seg, :r, :f, :m, :cl, :run)'
)

# Días desde la última compra → score (5 = compró hace poco)
R_BINS = [-1, 30, 60, 120, 240, float("inf")]
R_LABELS = [5, 4, 3, 2, 1]
# N.º de compras → score (5 = compra muy seguido)
F_BINS = [0, 1, 2, 4, 7, float("inf")]
F_LABELS = [1, 2, 3, 4, 5]


def _monetary_score(s: pd.Series) -> pd.Series:
    try:
        return pd.qcut(s.rank(method="average"), 5, labels=[1, 2, 3, 4, 5]).astype(int)
    except ValueError:
        return pd.Series(3, index=s.index)  # sin variabilidad suficiente


def _segment(r: int, f: int) -> str:
    if r >= 4 and f >= 4:
        return "champions"
    if r >= 3 and f >= 3:
        return "leales"
    if r >= 4 and f == 1:
        return "nuevos"
    if r <= 2 and f >= 3:
        return "en_riesgo"
    if r <= 2:
        return "hibernando"
    return "prometedores"


def main() -> None:
    with model_run("rfm", "1.1.0", notes="Fase 2 — RFM (umbrales fijos) + KMeans") as run:
        df = read_sql(
            f'''SELECT o."userId" AS user_id,
                      EXTRACT(EPOCH FROM (now() - MAX(o."createdAt"))) / 86400 AS recency,
                      COUNT(*) AS frequency,
                      SUM(o."totalCLP") AS monetary
               FROM "Order" o
               WHERE {SALE_SQL}
               GROUP BY 1'''
        )
        run.set_rows_in(len(df))
        if len(df) < 5:
            print("Muy pocos clientes con compras — nada que segmentar.")
            return

        df["recency"] = df["recency"].astype(float).clip(lower=0).round()
        df["r"] = pd.cut(df["recency"], R_BINS, labels=R_LABELS).astype(int)
        df["f"] = pd.cut(df["frequency"], F_BINS, labels=F_LABELS).astype(int)
        df["m"] = _monetary_score(df["monetary"])
        df["segment"] = [_segment(r, f) for r, f in zip(df["r"], df["f"])]

        # KMeans (4 clusters) sobre RFM. Frecuencia y monto en log: son muy
        # asimétricos y, sin log, unos pocos clientes grandes dominan los clusters.
        feats = np.column_stack([
            df["recency"].to_numpy(dtype=float),
            np.log1p(df["frequency"].to_numpy(dtype=float)),
            np.log1p(df["monetary"].to_numpy(dtype=float)),
        ])
        X = StandardScaler().fit_transform(feats)
        k = min(4, len(df))
        km = KMeans(n_clusters=k, random_state=42, n_init=10).fit(X)
        df["cluster"] = km.labels_
        sil = float(silhouette_score(X, km.labels_)) if k > 1 else 0.0

        rows = [{
            "id": f"seg_{run.id[:8]}_{i}", "uid": row.user_id, "seg": row.segment,
            "r": int(row.r), "f": int(row.f), "m": int(row.m),
            "cl": int(row.cluster), "run": run.id,
        } for i, row in enumerate(df.itertuples(index=False))]

        replace_rows('DELETE FROM "CustomerSegment"', INSERT_SQL, rows)

        dist = {k: int(v) for k, v in df["segment"].value_counts().items()}
        run.set_metrics({"clientes": len(df), "clusters": k, "silhouette": round(sil, 3),
                         "distribucion": dist,
                         "recompra_pct": round(float((df["frequency"] >= 2).mean()), 3)})
        print(f"CustomerSegment: {len(df)} clientes · {k} clusters "
              f"(silhouette {sil:.3f}) · {dist}")


if __name__ == "__main__":
    main()
