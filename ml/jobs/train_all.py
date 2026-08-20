"""Orquestador del pipeline: corre todos los jobs en orden de dependencia.

Es el entrypoint que usa GitHub Actions. El orden importa: restock depende del
forecast. Cada job es independiente y trazable por su ModelRun.

Ejecutar (desde ml/):  python -m jobs.train_all
"""

from __future__ import annotations

from jobs import customer_rfm, forecast_demand, kpi_snapshots, market_basket, restock


def main() -> None:
    print("== Fase 1: KPIs descriptivos ==")
    kpi_snapshots.main()
    print("\n== Fase 2: forecast de demanda ==")
    forecast_demand.main()
    print("\n== Fase 2: reposicion (usa forecast) ==")
    restock.main()
    print("\n== Fase 2: segmentacion RFM ==")
    customer_rfm.main()
    print("\n== Fase 2: recomendador market-basket ==")
    market_basket.main()
    print("\nPipeline completo.")


if __name__ == "__main__":
    main()
