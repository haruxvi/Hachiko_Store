"""Hito de la Fase 0: prueba el pipeline de punta a punta.

No entrena nada real: solo demuestra que Python puede (1) LEER el esquema
operacional desde Neon y (2) ESCRIBIR una fila en el plano analítico con
trazabilidad. Al terminar, esa fila ModelRun es visible desde Next/Prisma.

Ejecutar (desde la carpeta ml/):
    python -m jobs.smoke_test
"""

from __future__ import annotations

from ml.db import read_sql
from ml.model_run import model_run


def main() -> None:
    with model_run("smoke_test", "0.1.0", notes="Prueba de pipeline Fase 0") as run:
        # (1) LEER datos operacionales
        productos = read_sql('SELECT COUNT(*) AS n FROM "Product"')["n"].iloc[0]
        pagadas = read_sql(
            'SELECT COUNT(*) AS n FROM "Order" WHERE "paymentStatus" = \'PAID\''
        )["n"].iloc[0]

        # (2) Registrar métricas de la corrida (trazabilidad)
        run.set_rows_in(int(pagadas))
        run.set_metrics({"productos": int(productos), "ordenes_pagadas": int(pagadas)})

        print(f"Leído desde Neon: {productos} productos, {pagadas} órdenes pagadas.")
        print(f"ModelRun escrito con id={run.id} (SUCCESS).")
        print("Verifícalo desde Next: db.modelRun.findMany().")


if __name__ == "__main__":
    main()
