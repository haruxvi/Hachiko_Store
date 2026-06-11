# Madurez de procesos — CMMI-DEV

Mapeo de las áreas de proceso de **CMMI-DEV** (niveles 2 y 3) a las prácticas establecidas
en este proyecto. La meta práctica: que el proceso esté **definido y estandarizado** (nivel
3, "Defined"), de modo que los resultados no dependan de quién programa, sino del proceso.

> Contexto honesto: CMMI evalúa organizaciones, no repositorios, y este es un proyecto de
> equipo pequeño. Lo que se documenta aquí es la **institucionalización de las prácticas**
> que CMMI exige, en la escala que corresponde.

## Nivel 2 — Gestionado

| Área de proceso | Práctica institucionalizada en Hachiko |
|---|---|
| **REQM** — Gestión de requisitos | Requisitos funcionales/legales trazados en `docs/ciclo-de-vida-iso12207.md` §1.1; cambios de alcance entran por issue, nunca "de palabra" |
| **PP / PMC** — Planificación y monitoreo | Trabajo planificado en issues/PRs de GitHub; el estado real es visible en el tablero y en CI; la DoD define "terminado" sin ambigüedad |
| **CM** — Gestión de configuración | Git como única fuente de verdad; lockfile congelado; migraciones de BD versionadas (`prisma/migrations`); secretos fuera del repo con contrato en `.env.example` |
| **PPQA** — Aseguramiento de calidad de proceso y producto | Plan SQA (`docs/plan-sqa-ieee730.md`) con gates automáticos en CI: la calidad no es opinión del revisor, es un pipeline que bloquea |
| **MA** — Medición y análisis | Métricas definidas con fuente y objetivo (`plan-sqa-ieee730.md` §9): CVE abiertas, tiempos de parcheo, Lighthouse, estado de suite |
| **SAM** — Gestión de acuerdos con proveedores | Proveedores críticos (Transbank, Mercado Pago, Neon, Vercel, Resend) integrados vía SDK/contrato oficial; titularidad y reemplazo de credenciales definidos en `docs/deploy.md` fase 2 |

## Nivel 3 — Definido

| Área de proceso | Práctica institucionalizada en Hachiko |
|---|---|
| **RD** — Desarrollo de requisitos | Requisitos no funcionales derivados de normas concretas (ISO 25010/25012, OWASP, leyes 21.719/21.459/21.663) y documentados antes de construir |
| **TS** — Solución técnica | Arquitectura en capas con reglas explícitas y verificables en revisión (`ciclo-de-vida-iso12207.md` §1.2); decisiones no obvias comentadas en el código con su *porqué* |
| **PI** — Integración de producto | Integración continua: cada push compila, testea y audita el producto completo, incluido el build de producción |
| **VER** — Verificación | Pirámide de pruebas + revisión de PR contra DoD (`plan-sqa-ieee730.md` §5–6) |
| **VAL** — Validación | Checklist end-to-end en ambiente real con pasarelas de integración antes de cada release (`deploy.md` §1.7) |
| **OPD / OPF** — Definición y mejora de procesos | Este conjunto de documentos en `docs/` ES el proceso definido; toda mejora de proceso se versiona en git como cualquier cambio |
| **OT** — Formación organizacional | Documentación de onboarding: README → docs → comentarios de código; la guía de despliegue permite que un tercero opere el sistema sin conocimiento tribal |
| **RSKM** — Gestión de riesgos | Riesgos técnicos identificados y mitigados o documentados como excepción (`seguridad-owasp.md` §Decisiones); SLA de vulnerabilidades; plan de rotación de secretos en la entrega |
| **DAR** — Análisis de decisiones | Decisiones con trade-off documentadas junto a su alternativa y criterio de revisión (p. ej. rate-limit en memoria vs Redis, `<img>` vs `next/image`, CSP con `unsafe-inline`) |

## Qué falta para una madurez mayor (deuda de proceso conocida)

- **Métricas cuantitativas de proceso** (nivel 4): hoy se miden resultados (CVE, tests), no
  rendimiento estadístico del proceso. Razonable a esta escala.
- **E2E automatizado en CI**: Playwright está preparado pero los flujos críticos aún se
  validan con la guía manual. Pendiente antes del go-live.
- **Revisión de pares formal**: con un solo desarrollador, la revisión de PR la cubre
  parcialmente el pipeline + self-review contra la DoD. Si el equipo crece, activar
  required reviews en GitHub.
