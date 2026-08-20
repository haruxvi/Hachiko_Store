"""Conexión a Neon Postgres para el pipeline de ML.

Regla de propiedad del esquema: Prisma es el ÚNICO dueño del DDL (crea y altera
tablas). Este módulo solo hace SELECT sobre las tablas operacionales e
INSERT/UPSERT sobre las derivadas — nunca ejecuta migraciones.

Se usa la conexión DIRECTA (DIRECT_URL, no pooled): los jobs de entrenamiento
son de larga duración y saturarían el pooler serverless de Neon.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

# En local se toma DIRECT_URL del .env de la raíz del repo (no se duplica el
# secreto). En GitHub Actions la variable ya viene del entorno (secret) y
# load_dotenv no la sobrescribe.
_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")

_raw = os.environ.get("DIRECT_URL")
if not _raw:
    raise RuntimeError(
        "Falta DIRECT_URL. En local defínela en el .env de la raíz; en CI, "
        "como secret del repositorio."
    )

# SQLAlchemy 2 + driver psycopg3
DATABASE_URL = _raw.replace("postgresql://", "postgresql+psycopg://", 1)

engine: Engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def new_id() -> str:
    """Genera un id para filas insertadas desde Python.

    Las columnas id usan `@default(cuid())` en Prisma, pero ese default es del
    lado de la aplicación: al insertar por SQL crudo debemos aportar el id.
    Un uuid4 hex es un String único válido y suficiente.
    """
    return uuid.uuid4().hex


def read_sql(query: str, params: dict | None = None) -> pd.DataFrame:
    """Lee datos operacionales a un DataFrame de pandas."""
    return pd.read_sql(query, engine, params=params)


def execute(sql: str, params: dict | None = None) -> None:
    """Ejecuta una sentencia (DELETE/UPDATE) en una transacción."""
    with engine.begin() as conn:
        conn.execute(text(sql), params or {})


def execute_many(sql: str, rows: list[dict]) -> None:
    """Inserta muchas filas en lotes dentro de una transacción."""
    if not rows:
        return
    with engine.begin() as conn:
        for i in range(0, len(rows), 500):
            conn.execute(text(sql), rows[i : i + 500])
