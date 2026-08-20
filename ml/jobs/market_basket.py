"""Fase 2 — Recomendador "se compran juntos" (reglas de asociación).

Para cada par de productos co-comprados calcula soporte, confianza y lift
(métricas clásicas de market-basket analysis). Por cada producto ancla guarda
las mejores recomendaciones por lift (con un mínimo de co-ocurrencias para
filtrar ruido). Escribe ProductRecommendation (strategy=BASKET).

Implementación transparente en pandas — sin dependencias extra.

Ejecutar (desde ml/):  python -m jobs.market_basket
"""

from __future__ import annotations

from collections import Counter, defaultdict
from itertools import combinations

from ml.db import execute, execute_many, read_sql
from ml.model_run import model_run

MIN_COOCCUR = 5   # co-ocurrencias mínimas para considerar una regla
TOP_K = 6         # recomendaciones por producto

INSERT_SQL = (
    'INSERT INTO "ProductRecommendation" '
    '(id, "productId", "recommendedProductId", strategy, score, "modelRunId") '
    'VALUES (:id, :a, :b, CAST(:st AS "RecommendationStrategy"), :score, :run)'
)


def main() -> None:
    with model_run("market_basket", "1.0.0", notes="Fase 2 — reglas de asociación") as run:
        df = read_sql(
            '''SELECT oi."orderId" AS order_id, oi."productId" AS product_id
               FROM "OrderItem" oi
               JOIN "Order" o ON o.id = oi."orderId"
               WHERE o."paymentStatus" = 'PAID' '''
        )
        run.set_rows_in(len(df))
        baskets = df.groupby("order_id")["product_id"].apply(lambda s: sorted(set(s)))
        total = len(baskets)
        if total == 0:
            print("Sin canastas — nada que recomendar.")
            return

        item_count: Counter = Counter()
        pair_count: Counter = Counter()
        for items in baskets:
            item_count.update(items)
            for a, b in combinations(items, 2):
                pair_count[(a, b)] += 1

        # Genera reglas dirigidas A→B con lift, para ambos sentidos del par
        recos: dict[str, list[tuple[str, float]]] = defaultdict(list)
        for (a, b), co in pair_count.items():
            if co < MIN_COOCCUR:
                continue
            support = co / total
            for x, y in ((a, b), (b, a)):
                confidence = co / item_count[x]
                lift = confidence / (item_count[y] / total)
                if lift > 1.0:  # solo asociaciones positivas
                    recos[x].append((y, round(lift, 4)))
            _ = support

        rows: list[dict] = []
        seq = 0
        for a, lst in recos.items():
            for b, lift in sorted(lst, key=lambda t: t[1], reverse=True)[:TOP_K]:
                seq += 1
                rows.append({"id": f"rec_{run.id[:8]}_{seq}", "a": a, "b": b,
                             "st": "BASKET", "score": lift, "run": run.id})

        execute('DELETE FROM "ProductRecommendation" WHERE strategy = \'BASKET\'')
        execute_many(INSERT_SQL, rows)

        run.set_metrics({"canastas": total, "pares": len(pair_count),
                         "reglas": len(rows), "productos_con_reco": len(recos)})
        print(f"ProductRecommendation: {len(rows)} reglas para {len(recos)} productos "
              f"(de {total} canastas).")


if __name__ == "__main__":
    main()
