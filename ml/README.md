# Pipeline de ML — Hachiko (`/ml`)

Proyecto Python **independiente** del app Next.js. Corre por batch (fuera de
Vercel), lee Neon, entrena modelos y escribe predicciones en el plano
analítico. Documentación completa: [`docs/machine-learning.md`](../docs/machine-learning.md).

## Arranque local

```bash
cd ml
python -m venv .venv
# Windows:
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m jobs.smoke_test
# Linux/macOS:
# .venv/bin/pip install -r requirements.txt
# .venv/bin/python -m jobs.smoke_test
```

La conexión toma `DIRECT_URL` del `.env` de la raíz del repo (no se duplica el
secreto). `smoke_test` prueba el pipeline de punta a punta: lee datos de Neon y
escribe una fila `ModelRun` visible desde Next.

## Estructura

```
ml/
├── requirements.txt        núcleo + libs por fase (comentadas)
├── ml/
│   ├── db.py               conexión a Neon (DIRECT_URL) + helpers
│   └── model_run.py        trazabilidad de entrenamientos (ModelRun)
├── jobs/
│   └── smoke_test.py       hito Fase 0: pipeline end-to-end
└── notebooks/              exploración de datos (tesis)
```

## Regla de oro

Prisma es el único dueño del esquema. Este proyecto **nunca** crea ni altera
tablas: solo `SELECT` de las operacionales e `INSERT/UPSERT` en las derivadas.
