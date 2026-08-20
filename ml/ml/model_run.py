"""Trazabilidad de entrenamientos — espejo analítico del AuditLog.

Cada job de ML abre un ModelRun (estado RUNNING), y al terminar lo cierra como
SUCCESS con sus métricas o FAILED si algo falla. Toda predicción que un job
escriba debe referenciar `modelRunId`, de modo que siempre se pueda responder
"¿qué modelo y versión generó este número?".
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import datetime, timezone

from sqlalchemy import text

from .db import engine, new_id


@contextmanager
def model_run(model_type: str, version: str, notes: str | None = None):
    """Context manager que registra una corrida de entrenamiento.

    Uso:
        with model_run("demand_forecast", "0.1.0") as run:
            ...
            run.set_metrics({"mae": 3.2})
            run.set_rows_in(1420)
    """
    run_id = new_id()
    started = datetime.now(timezone.utc)

    with engine.begin() as conn:
        conn.execute(
            text(
                'INSERT INTO "ModelRun" (id, "modelType", version, status, '
                '"startedAt", notes) VALUES (:id, :mt, :v, :st, :started, :notes)'
            ),
            {
                "id": run_id,
                "mt": model_type,
                "v": version,
                "st": "RUNNING",
                "started": started,
                "notes": notes,
            },
        )

    state = {"metrics": None, "rows_in": None}

    class _Handle:
        id = run_id

        def set_metrics(self, metrics: dict) -> None:
            state["metrics"] = metrics

        def set_rows_in(self, n: int) -> None:
            state["rows_in"] = n

    try:
        yield _Handle()
    except Exception as exc:  # noqa: BLE001 — se re-lanza tras marcar FAILED
        _close(run_id, "FAILED", state, error=str(exc))
        raise
    else:
        _close(run_id, "SUCCESS", state)


def _close(run_id: str, status: str, state: dict, error: str | None = None) -> None:
    metrics = state["metrics"]
    if error:
        metrics = {**(metrics or {}), "error": error}
    with engine.begin() as conn:
        conn.execute(
            text(
                'UPDATE "ModelRun" SET status = :st, "finishedAt" = :fin, '
                '"rowsIn" = :rows, metrics = CAST(:metrics AS jsonb) '
                'WHERE id = :id'
            ),
            {
                "id": run_id,
                "st": status,
                "fin": datetime.now(timezone.utc),
                "rows": state["rows_in"],
                "metrics": json.dumps(metrics) if metrics is not None else None,
            },
        )
