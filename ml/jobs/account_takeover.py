"""Fase 3 — Detección de account-takeover / credential-stuffing.

Analiza los inicios de sesión de AuditLog de los últimos WINDOW_DAYS días para
detectar cuentas en riesgo, con tres niveles (el modelo apoya, la acción es humana):

  - CRÍTICO (≥ 0.9): posible cuenta comprometida — un inicio de sesión EXITOSO
    desde una IP de credential stuffing (que probó MUCHAS cuentas), después de
    que esa IP fallara contra esta cuenta. El dueño no entra desde una IP así.
  - ALTO (0.6–0.9): fuerza bruta — muchos fallos sobre UNA cuenta concentrados
    en BRUTE_FORCE_HOURS horas. Si después hubo un acceso exitoso desde esa
    misma IP sube a 0.8: puede ser el atacante… o el dueño que por fin recordó
    su clave, así que se verifica, no se da por comprometida.
  - BAJO (0.3): la cuenta solo recibió intentos de una IP de credential stuffing
    sin acceso logrado. Es un ataque al sitio, no a esa persona.

Antes 8 fallos repartidos en un mes ya eran "fuerza bruta", y quien olvidaba su
clave y luego entraba quedaba como "cuenta comprometida" (alerta crítica falsa).

Escribe RiskScore (subjectType=USER) con score 0..1 y señales explicables.

Ejecutar (desde ml/):  python -m jobs.account_takeover
"""

from __future__ import annotations

import json

from ml.db import read_sql, replace_rows
from ml.model_run import model_run

WINDOW_DAYS = 30
BRUTE_FORCE_MIN = 8      # fallos sobre una cuenta dentro de BRUTE_FORCE_HOURS = fuerza bruta
BRUTE_FORCE_HOURS = 24   # la app bloquea 15 min cada 5 fallos: un ataque igual junta 8+ en un día
STUFFING_IP_MIN = 10     # cuentas distintas golpeadas por una IP = stuffing

INSERT_SQL = (
    'INSERT INTO "RiskScore" '
    '(id, "subjectType", "subjectId", score, reasons, "modelRunId") '
    'VALUES (:id, CAST(:st AS "RiskSubject"), :sid, :score, CAST(:reasons AS jsonb), :run)'
)


def main() -> None:
    with model_run("account_takeover", "1.2.0", notes="Fase 3 — ATO / credential stuffing") as run:
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

        # Fuerza bruta: el máximo de fallos de cada cuenta en cualquier ventana
        # móvil de BRUTE_FORCE_HOURS (no el total del mes).
        burst = (fails.sort_values("at").set_index("at").groupby("user_id")["action"]
                 .rolling(f"{BRUTE_FORCE_HOURS}h").count().groupby(level=0).max())
        per_user = fails.groupby("user_id").agg(n=("ip", "size"), ips=("ip", "nunique"))
        per_user["burst"] = burst.reindex(per_user.index).fillna(0)
        # to_dict: valores nativos (el checker no acepta int() sobre un "Scalar").
        stats: dict = per_user.to_dict("index")
        brute_users = {uid for uid, st in stats.items() if st["burst"] >= BRUTE_FORCE_MIN}

        # Primer fallo de cada IP contra cada cuenta: un acceso solo cuenta como
        # sospechoso si llega DESPUÉS de que esa IP empezara a fallar.
        first_fail: dict = fails.groupby(["user_id", "ip"])["at"].min().to_dict()
        logins = df[df["action"] == "LOGIN"].to_dict("records")

        def after_fail(r: dict) -> bool:
            t = first_fail.get((r["user_id"], r["ip"]))
            return t is not None and r["at"] > t

        compromised = {r["user_id"] for r in logins if r["ip"] in stuffing_ips and after_fail(r)}
        brute_then_in = {r["user_id"] for r in logins if r["user_id"] in brute_users and after_fail(r)}
        stuffing_users = set(fails[fails["ip"].isin(stuffing_ips)]["user_id"])

        flagged: dict[str, dict] = {}
        for uid in compromised | brute_users | stuffing_users:
            reasons: list[str] = []
            score = 0.0
            if uid in compromised:
                reasons.append("inicio de sesión exitoso desde una IP que probó muchas cuentas")
                score = 0.95
            if uid in brute_users:
                st = stats[uid]
                n_burst = int(st["burst"])
                reasons.append(f"{n_burst} intentos fallidos en menos de {BRUTE_FORCE_HOURS} h "
                               f"({int(st['n'])} en {WINDOW_DAYS} días, desde {int(st['ips'])} IP(s))")
                score = max(score, min(0.75, 0.6 + (n_burst - BRUTE_FORCE_MIN) / 50))
                if uid in brute_then_in:
                    reasons.append("después entró desde la misma IP: confirma con el cliente que fue él")
                    score = max(score, 0.8)
            if uid in stuffing_users and uid not in compromised:
                reasons.append("recibió intentos de una IP que probó muchas cuentas (sin acceso)")
                score = max(score, 0.3)
            flagged[str(uid)] = {"score": round(score, 4), "reasons": reasons}

        rows = [{
            "id": f"ato_{run.id[:8]}_{i}", "st": "USER", "sid": uid,
            "score": v["score"], "reasons": json.dumps(v["reasons"], ensure_ascii=False), "run": run.id,
        } for i, (uid, v) in enumerate(sorted(flagged.items(), key=lambda kv: -kv[1]["score"]))]

        replace_rows('DELETE FROM "RiskScore" WHERE "subjectType" = \'USER\'', INSERT_SQL, rows)

        run.set_metrics({"intentos": len(fails), "ventana_dias": WINDOW_DAYS,
                         "ips_stuffing": len(stuffing_ips), "comprometidas": len(compromised),
                         "fuerza_bruta": len(brute_users), "fuerza_bruta_con_acceso": len(brute_then_in),
                         "cuentas_marcadas": len(rows)})
        print(f"RiskScore(USER): {len(compromised)} posibles comprometidas, {len(brute_users)} con fuerza "
              f"bruta, {len(rows)} marcadas en total ({len(stuffing_ips)} IP(s) de stuffing).")


if __name__ == "__main__":
    main()
