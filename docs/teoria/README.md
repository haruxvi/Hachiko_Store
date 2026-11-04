# Teoría detrás de Hachiko

Esta sección explica **por qué** el sistema está hecho como está: qué concepto de arquitectura,
bases de datos, seguridad, estadística o derecho respalda cada decisión. Sirve para preparar la
defensa ante la comisión. El **cómo** (qué archivo hace qué) está en
[`../codigo/`](../codigo/README.md).

| # | Documento | Qué explica |
|---|---|---|
| 1 | [Arquitectura: decisiones y alternativas](01-arquitectura.md) | Monolito modular, renderizado en el servidor, serverless, base relacional, bitácoras de solo inserción, dos planos de datos, un backend para tres interfaces |
| 2 | [Concurrencia, transacciones e idempotencia](02-concurrencia-y-transacciones.md) | ACID, niveles de aislamiento, *write skew*, Serializable (SSI), reintentos con *jitter*, reservas con TTL, *compare-and-set*, entrega "al menos una vez" |
| 3 | [Seguridad](03-seguridad.md) | Defensa en profundidad, argon2id, enumeración y canales de tiempo, JWT/JWE, rotación de refresh tokens, CSRF, XSS y CSP, AES-GCM, HMAC, TOTP, cadena de hash, archivos maliciosos |
| 4 | [Pagos en línea](04-pagos-en-linea.md) | Pasarelas con redirección, por qué no confiar en el navegador, webhooks firmados, conciliación, ambientes de integración |
| 5 | [Datos y machine learning](05-datos-y-ml.md) | BI y ML, Ridge y regularización, backtest y fuga de datos, MAE, punto de reorden, RFM, KMeans y silhouette, Isolation Forest, lift, ABC, z-score, elasticidad de arco |
| 6 | [Marco legal chileno](06-marco-legal.md) | Leyes 21.719, 19.496, 21.459 y 21.663, y obligaciones ante el SII, cada una con el módulo que la atiende |
| 7 | [Calidad y pruebas](07-calidad-y-pruebas.md) | Pirámide de pruebas, por qué la concurrencia necesita una base real, puertas de calidad, regla de regresión |
| — | [**Preguntas de la comisión**](preguntas-de-la-comision.md) | Las preguntas más probables, con una respuesta corta, el concepto que la respalda y dónde mostrarlo |

**Para preparar la presentación:** empieza por las preguntas y, cuando una respuesta te deje
dudas, abre el documento de teoría de su tema.
