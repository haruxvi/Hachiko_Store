"""Fase 3 — Detección de account-takeover / credential-stuffing.

Analiza los intentos de login fallidos de AuditLog para detectar cuentas bajo
ataque, con dos patrones clásicos:
  - Fuerza bruta / ATO: muchos fallos concentrados sobre UNA cuenta.
  - Credential stuffing: una IP que golpea MUCHAS cuentas distintas → todas las
    cuentas golpeadas por esa IP quedan marcadas.
Escribe las cuentas en riesgo en RiskScore (subjectType=USER), con score 0..1 y
señales explicables. Detección por reglas + umbrales — transparente y auditable,
lo apropiado para seguridad (el modelo apoya, la acción es humana).

Ejecutar (desde ml/):  python -m jobs.account_takeover
"""

from __future__ import annotations

import json

from ml.db import execute, execute_many, read_sql
from ml.model_run import model_run

BRUTE_FORCE_MIN = 8      # fallos sobre una cuenta para considerarla atacada
STUFFING_IP_MIN = 10     # cuentas distintas golpeadas por una IP = stuffing

INSERT_SQL = (
    'INSERT INTO "RiskScore" '
    '(id, "subjectType", "subjectId", score, reasons, "modelRunId") '
    'VALUES (:id, CAST(:st AS "RiskSubject"), :sid, :score, CAST(:reasons AS jsonb), :run)'
)


def main() -> None:
    with model_run("account_takeover", "1.0.0", notes="Fase 3 — ATO / credential stuffing") as run:
        df = read_sql(
            '''SELECT "actorId" AS user_id, ip, "createdAt" AS at
               FROM "AuditLog"
               WHERE action = 'LOGIN_FAILED' AND "actorId" IS NOT NULL'''
        )
        run.set_rows_in(len(df))
        if df.empty:
            print("Sin intentos fallidos en AuditLog — nada que analizar.")
            return

        # IPs de credential stuffing: golpean muchas cuentas distintas
        by_ip = df.groupby("ip")["user_id"].nunique()
        stuffing_ips = set(by_ip[by_ip >= STUFFING_IP_MIN].index)

        # Agregados por cuenta
        per_user = df.groupby("user_id").agg(
            fails=("ip", "size"), ips=("ip", "nunique"),
        )
        # Cuentas tocadas por alguna IP de stuffing
        stuffing_users = set(df[df["ip"].isin(stuffing_ips)]["user_id"].unique())

        flagged: dict[str, dict] = {}
        for uid, r in per_user.iterrows():
            reasons: list[str] = []
            score = 0.0
            if r["fails"] >= BRUTE_FORCE_MIN:
                reasons.append(f"{int(r['fails'])} intentos fallidos desde {int(r['ips'])} IP(s)")
                score = max(score, min(1.0, r["fails"] / 25))
            if uid in stuffing_users:
                reasons.append("objetivo de credential stuffing (IP masiva)")
                score = max(score, 0.7)
            if reasons:
                flagged[uid] = {"score": round(float(score), 4), "reasons": reasons}

        rows = [{
            "id": f"ato_{run.id[:8]}_{i}", "st": "USER", "sid": uid,
            "score": v["score"], "reasons": json.dumps(v["reasons"], ensure_ascii=False), "run": run.id,
        } for i, (uid, v) in enumerate(flagged.items())]

        execute('DELETE FROM "RiskScore" WHERE "subjectType" = \'USER\'')
        execute_many(INSERT_SQL, rows)

        run.set_metrics({"intentos": len(df), "ips_stuffing": len(stuffing_ips),
                         "cuentas_marcadas": len(rows)})
        print(f"RiskScore(USER): {len(rows)} cuentas en riesgo "
              f"({len(stuffing_ips)} IP(s) de credential stuffing detectadas).")


if __name__ == "__main__":
    main()
