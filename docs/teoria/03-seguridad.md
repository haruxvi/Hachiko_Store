# 3. Seguridad: los conceptos detrás de cada control

Qué hace cada control en el código: [../codigo/10-seguridad-y-privacidad.md](../codigo/10-seguridad-y-privacidad.md)
y [../codigo/02-autenticacion.md](../codigo/02-autenticacion.md). El cruce con OWASP:
[seguridad-owasp.md](../seguridad-owasp.md).

## Principios generales

- **Defensa en profundidad.** Varias capas independientes, de modo que si una falla, otra
  detiene el ataque. Ejemplo: el panel se protege en el middleware, en el layout y en cada
  acción.
- **Mínimo privilegio.** Cada actor tiene solo lo que necesita: el cliente no ve el panel, el
  pipeline de ML no puede cambiar el esquema, los workflows de GitHub Actions declaran permisos
  mínimos (solo lectura del repositorio; el de auditoría, además, puede abrir issues) y como
  máximo hay 2 vendedores.
- ***Fail-closed* (fallar cerrado).** Ante un error o un dato inesperado, se niega. Un pago sin
  monto no se confirma, un cron sin secreto queda cerrado y un webhook sin firma válida se
  rechaza.
- **No confiar en el cliente.** Todo lo que llega del navegador o del teléfono (precio,
  cantidad, rol, monto pagado) se vuelve a calcular o a verificar en el servidor.

## Autenticación (quién eres) y autorización (qué puedes hacer)

- **Autenticación:** contraseña, más un segundo factor opcional.
- **Autorización:** RBAC (control de acceso basado en roles: CLIENT y SELLER) más **propiedad
  del recurso**. No basta con ser cliente: el pedido tiene que ser tuyo. Olvidar lo segundo es
  la vulnerabilidad IDOR/BOLA, la número 1 de OWASP (A01: Broken Access Control).

## Contraseñas: hash lento y con mucha memoria

- Una contraseña **no se cifra** (lo cifrado se puede descifrar): se le aplica un *hash*, una
  función de un solo sentido.
- Un hash rápido (SHA-256) se puede probar miles de millones de veces por segundo con tarjetas
  gráficas. **argon2id** es lento a propósito y exige **mucha memoria** (64 MiB por intento en
  Hachiko), lo que hace caro paralelizar el ataque. Ganó la Password Hashing Competition (2015)
  y es la primera recomendación de OWASP.
- argon2 incluye una **sal** aleatoria por contraseña: dos personas con la misma contraseña
  tienen hashes distintos, y las tablas precalculadas no sirven.

## Enumeración de cuentas y ataques de tiempo

- Si el login dijera "ese correo no existe", un atacante podría armar una lista de clientes. Por
  eso el mensaje es siempre el mismo.
- Pero el **tiempo** también delata: verificar argon2 toma un tiempo apreciable y "el usuario no
  existe" respondería al instante. Por eso, si el correo no existe, igual se verifica contra un
  hash de relleno. Es un caso de **canal lateral de tiempo** (*timing side channel*).
- Por la misma razón, los secretos (la firma de Mercado Pago, el secreto del cron) se comparan
  con `timingSafeEqual`, que toma el mismo tiempo aunque el primer carácter ya sea distinto.

## Fuerza bruta: límite de frecuencia y bloqueo

- **Límite de frecuencia por IP** (ventana fija: N intentos por ventana de tiempo). Frena a un
  atacante que prueba muchas cuentas desde una IP.
- **Bloqueo por cuenta** (5 fallos → 15 minutos). Frena a muchos atacantes contra una cuenta.
- **El costo del bloqueo:** alguien podría bloquear a propósito la cuenta de otro. Por eso el
  bloqueo dura poco y no es permanente.
- **Credential stuffing:** probar contraseñas filtradas de otros sitios en muchas cuentas. Lo
  detecta el job `account_takeover` cuando una IP toca 10 o más cuentas distintas.

## Sesiones con tokens

- **JWT** (RFC 7519) es un conjunto de "afirmaciones" (quién es, qué rol tiene, cuándo vence).
  Puede ir **firmado** (JWS: cualquiera lo lee, nadie lo altera) o **cifrado** (JWE, RFC 7516:
  además nadie lo lee). Hachiko usa JWE con AES-256-GCM.
- **El dilema de los tokens sin estado:** el servidor no consulta la base para validar un access
  token, lo que lo hace rápido, pero por lo mismo **no se puede revocar antes de que venza**. La
  solución estándar:
  - un **access corto** (15 minutos);
  - un **refresh largo** (7 días), que **sí** se valida contra la base al renovar (cuenta
    borrada, bloqueada, cambio de rol, `tokenVersion`).
- **Rotación con detección de reutilización** (RFC 6819 §5.2.2.3 y la guía actual de OAuth 2.0
  para clientes):
  - Cada refresh sirve **una vez**.
  - Si un token ya usado vuelve a aparecer, hay dos copias: la del usuario y la de un ladrón.
    El servidor no sabe cuál es cuál, así que revoca la familia completa y ambos deben volver a
    iniciar sesión.
  - La ventana de 30 segundos evita castigar a dos pestañas que renuevan a la vez.

## Cookies, CSRF y XSS

- **`HttpOnly`:** JavaScript no puede leer la cookie. Aunque existiera un XSS, no podría robar
  la sesión.
- **`Secure`:** la cookie solo viaja por HTTPS.
- **`SameSite=Strict`:** la cookie no viaja en peticiones que inicia otro sitio. Es la defensa
  principal contra **CSRF** (un sitio malicioso que hace que tu navegador ejecute una acción en
  Hachiko con tu sesión).
- **XSS** (inyectar un script en la página) se frena en dos frentes:
  - React escapa el texto por defecto.
  - La **Content-Security-Policy** con *nonce*: cada respuesta trae un número aleatorio y el
    navegador solo ejecuta los `<script>` que lo llevan. `strict-dynamic` permite que esos
    scripts carguen otros, sin tener que mantener una lista de dominios.

## Criptografía aplicada

| Uso | Algoritmo | Por qué |
|---|---|---|
| Datos personales y sesiones | **AES-256-GCM** | Cifrado **autenticado** (AEAD): oculta el contenido **y** detecta si alguien lo modificó (la etiqueta de 16 bytes). El IV de 12 bytes es aleatorio por mensaje, porque repetir el IV con la misma clave rompe GCM |
| Contraseñas | **argon2id** | Ver arriba |
| Tokens de correo | **SHA-256** del token | Se guarda solo el hash: quien lea la base no puede usar el enlace |
| Firma de webhooks | **HMAC-SHA256** | Prueba que el mensaje lo envió quien conoce el secreto compartido y que no fue alterado |
| Bitácora de incidencias | **Cadena de SHA-256** | Ver abajo |
| Doble factor | **TOTP** (RFC 6238) | HMAC-SHA1 sobre el número de intervalos de 30 segundos desde 1970. El teléfono y el servidor calculan lo mismo sin comunicarse |

Sobre TOTP: SHA-1 está roto para encontrar colisiones, pero eso **no afecta a HMAC-SHA1**, que
sigue siendo seguro como función pseudoaleatoria. Por eso RFC 6238 lo mantiene como valor por
defecto y lo soportan todas las apps de autenticación. Además, cada código se puede usar **una
sola vez**: así se evita que un código interceptado se reutilice dentro de su ventana de 30
segundos.

## Bitácora encadenada por hash

Cada evento guarda `hash = SHA-256(datos del evento + hash del evento anterior)`. Si alguien
cambia, borra o reordena un evento, su hash deja de coincidir, y con él todos los siguientes.

- **Es evidencia de manipulación (*tamper-evident*), no prueba de manipulación
  (*tamper-proof*).** Quien controle la base podría recalcular toda la cadena. Para impedirlo
  habría que publicar el último hash fuera del sistema (por ejemplo, en el informe enviado a la
  autoridad, que lo incluye).
- Es la misma estructura que usa un blockchain, sin consenso distribuido.

## Archivos subidos

Un archivo es una entrada más, y de las más peligrosas:

- **Bomba zip:** un ZIP pequeño que se expande a gigabytes. Se descomprime con un tope real.
- **XXE** (entidades XML externas): un XML con `<!ENTITY>` puede leer archivos del servidor o
  agotar la memoria ("billion laughs"). Se rechaza cualquier `DOCTYPE` o `ENTITY`.
- **Tipo falso:** un ejecutable renombrado a `.png`. Se verifica la **firma real** (los primeros
  bytes), no la extensión ni el `Content-Type`.
- **Inyección de fórmulas (CSV injection):** una celda `=HYPERLINK(...)` que se ejecuta cuando
  alguien abre la exportación en Excel. Se detecta y se rechaza.
