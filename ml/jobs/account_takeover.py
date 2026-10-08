"""Fase 3 — Detección de account-takeover / credential-stuffing.

Analiza los inicios de sesión de AuditLog de los últimos WINDOW_DAYS días para
detectar cuentas en riesgo, con tres niveles (el modelo apoya, la acción es humana):

  - CRÍTICO (≥ 0.9): posible cuenta comprometida — un inicio de sesión EXITOSO
    desde una IP que estaba atacando (stuffing o fuerza bruta).
  - ALTO (0.6–0.9): fuerza bruta — muchos fallos concentrados sobre UNA cuenta.
  - BAJO (0.3): la cuenta solo recibió intentos de una IP de credential stuffing
    (una IP que prueba MUCHAS cuentas). Es un ataque al sitio, no a esa persona:
    sin acceso logrado no se trata como "cuenta bajo ataque".

Antes cualquier cuenta tocada una vez por una IP masiva quedaba con riesgo 0.7
y como alerta crítica, y los fallos no expiraban nunca.

Escribe RiskScore (subjectType=USER) con score 0..1 y señales explicables.

Ejecutar (desde ml/):  python -m jobs.account_takeover
"""

from __future__ import annotations

import json

from ml.db import read_sql, replace_rows
from ml.model_run import model_run

WINDOW_DAYS = 30
BRUTE_FORCE_MIN = 8      # fallos sobre una cuenta en la ventana = fuerza bruta
STUFFING_IP_MIN = 10     # cuentas distintas golpeadas por una IP = stuffing

INSERT_SQL = (
    'INSERT INTO "RiskScore" '
    '(id, "subjectType", "subjectId", score, reasons, "modelRunId") '
    'VALUES (:id, CAST(:st AS "RiskSubject"), :sid, :score, CAST(:reasons AS jsonb), :run)'
)


def main() -> None:
    with model_run("account_takeover", "1.1.0", notes="Fase 3 — ATO / credential stuffing") as run:
        df = read_sql(
            f'''SELECT "actorId" AS user_id, ip, action, "createdAt" AS at
               FROM "AuditLog"
               WHERE action IN ('LOGIN_FAILED', 'LOGIN') AND "actorId" IS NOT NULL
                 AND "createdAt" >= now() - make_interval(days => {int(WINDOW_DAYS)})'''
        )
        run.set_rows_in(len(df))
        fails = df[df["action"] == "LOGIN_FAILED"]
        if fails.empty:
            replace_rows('DELETE FROM "RiskScore" WHERE "subjectType" = \'USER\'', INSERT_SQL, [])
            print(f"Sin intentos fallidos en {WINDOW_DAYS} días — nada que analizar.")
            return

        by_ip = fails.groupby("ip")["user_id"].nunique()
        stuffing_ips = set(by_ip[by_ip >= STUFFING_IP_MIN].index)
        per_user = fails.groupby("user_id").agg(n=("ip", "size"), ips=("ip", "nunique"))
        brute_users = set(per_user[per_user["n"] >= BRUTE_FORCE_MIN].index)
        attacker_ips = stuffing_ips | set(fails[fails["user_id"].isin(brute_users)]["ip"])

        # Éxito desde una IP atacante, DESPUÉS de su primer fallo contra esa cuenta.
        first_fail = fails.groupby(["user_id", "ip"])["at"].min()
        ok = df[(df["action"] == "LOGIN") & df["ip"].isin(attacker_ips)]
        compromised = {
            r.user_id for r in ok.itertuples(index=False)
            if (r.user_id, r.ip) in first_fail.index and r.at > first_fail[(r.user_id, r.ip)]
        }
        stuffing_users = set(fails[fails["ip"].isin(stuffing_ips)]["user_id"])

        flagged: dict[str, dict] = {}
        for uid in compromised | brute_users | stuffing_users:
            reasons: list[str] = []
            score = 0.0
            if uid in compromised:
                reasons.append("inicio de sesión exitoso desde una IP que estaba atacando")
                score = 0.95
            if uid in brute_users:
                r = per_user.loc[uid]
                reasons.append(f"{int(r['n'])} intentos fallidos desde {int(r['ips'])} IP(s) en {WINDOW_DAYS} días")
                score = max(score, min(0.9, 0.6 + (r["n"] - BRUTE_FORCE_MIN) / 50))
            if uid in stuffing_users:
                reasons.append("recibió intentos de una IP que probó muchas cuentas (sin acceso)")
                score = max(score, 0.3)
            flagged[uid] = {"score": round(float(score), 4), "reasons": reasons}

        rows = [{
            "id": f"ato_{run.id[:8]}_{i}", "st": "USER", "sid": uid,
            "score": v["score"], "reasons": json.dumps(v["reasons"], ensure_ascii=False), "run": run.id,
        } for i, (uid, v) in enumerate(sorted(flagged.items(), key=lambda kv: -kv[1]["score"]))]

        replace_rows('DELETE FROM "RiskScore" WHERE "subjectType" = \'USER\'', INSERT_SQL, rows)

        run.set_metrics({"intentos": len(fails), "ventana_dias": WINDOW_DAYS,
                         "ips_stuffing": len(stuffing_ips), "comprometidas": len(compromised),
                         "fuerza_bruta": len(brute_users), "cuentas_marcadas": len(rows)})
        print(f"RiskScore(USER): {len(compromised)} posibles comprometidas, {len(brute_users)} con fuerza "
              f"bruta, {len(rows)} marcadas en total ({len(stuffing_ips)} IP(s) de stuffing).")


if __name__ == "__main__":
    main()
