# 2. Cuentas, sesiones y roles

Archivos centrales: [auth.service.ts](../../src/lib/services/auth.service.ts),
[jwt.ts](../../src/lib/auth/jwt.ts), [session.ts](../../src/lib/auth/session.ts),
[rotate.ts](../../src/lib/auth/rotate.ts), [totp.ts](../../src/lib/auth/totp.ts),
[middleware.ts](../../src/middleware.ts).

## Roles

Hay dos roles (`enum Role` en el esquema): **CLIENT** compra y **SELLER** opera la
trastienda. Un cliente invitado es un `CLIENT` con `isGuest = true`. Como máximo puede haber
**2 vendedores** (`MAX_SELLERS` en [seller-limit.ts](../../src/lib/auth/seller-limit.ts)):
aunque alguien lograra promover una cuenta, no puede multiplicar el acceso al panel.

## Registro

- Ruta `POST /api/auth/register`, con límite de 5 registros por minuto por IP.
- La contraseña se guarda con **argon2id** (64 MiB de memoria, 3 iteraciones, paralelismo 4),
  definido en `ARGON2_OPTIONS`.
- Se registra el consentimiento: esencial obligatorio, comercial opcional, versión del texto,
  fecha e IP.
- **Si el correo ya existe, la respuesta es la misma que si no existiera.** Al dueño del correo
  le llega un aviso con enlaces a "iniciar sesión" y "recuperar contraseña", y queda el evento
  `REGISTER_EXISTING_EMAIL` en la bitácora. Así el registro no sirve para averiguar quién tiene
  cuenta.
- La verificación del correo usa un token de un solo uso que dura 24 horas.

## Inicio de sesión (`loginUser`)

1. Límite de **10 intentos por minuto por IP** ([login/route.ts](../../src/app/api/auth/login/route.ts)).
2. Si el correo no existe, igual se ejecuta una verificación argon2 contra un hash de relleno
   (`getDummyHash`). Así el tiempo de respuesta no revela si la cuenta existe. El mensaje de
   error es siempre "Credenciales inválidas".
3. Cada contraseña errada suma `failedLogins` con un incremento atómico. **Al quinto fallo la
   cuenta se bloquea 15 minutos** (`MAX_FAILED_LOGINS = 5`, `LOCK_DURATION_MS`). La prueba de
   integración comprueba que 10 intentos en paralelo cuentan como 10 y bloquean una sola vez.
4. Si la cuenta tiene **2FA**, se exige el código TOTP (ver abajo).
5. Si todo es correcto: se reinician los contadores, se guarda `lastLoginAt` y se abre una
   sesión nueva.

## Doble factor (TOTP)

- Estándar **RFC 6238**: 6 dígitos, periodos de 30 segundos y HMAC-SHA1. Funciona con Google
  Authenticator, Authy o Microsoft Authenticator, sin servicios externos.
- El secreto se guarda **cifrado** con AES-256-GCM (`encrypt` de
  [pii.ts](../../src/lib/crypto/pii.ts)).
- Se acepta el código del intervalo anterior o siguiente, para tolerar desfase de reloj.
- **Un código no se puede reutilizar.** `consumeTotpCode` guarda el número de intervalo usado
  (`totpLastStep`) con un `UPDATE` condicional que solo acepta intervalos posteriores.

## Las sesiones: dos tokens cifrados

| Token | Dura | Viaja en | Para qué |
|---|---|---|---|
| **Access** | 15 min | Cookie `hachiko_access` (web) o header `Authorization: Bearer` (app) | Identificar al usuario en cada petición |
| **Refresh** | 7 días | Cookie `hachiko_refresh` limitada a la ruta `/api/auth` (web) o llavero cifrado del teléfono (app) | Pedir un access nuevo sin volver a escribir la contraseña |

- Los tokens son **JWE cifrados** (algoritmo `dir` + `A256GCM`), no solo firmados. Quien
  intercepte la cookie no puede leer el rol ni el correo, y cualquier alteración la invalida. La
  clave de 32 bytes se deriva con SHA-256 de `JWT_SECRET`.
- Al descifrar se fijan los algoritmos aceptados (evita ataques de confusión de algoritmo), y
  un refresh no sirve como access porque se revisa el campo `type`.
- Las cookies son `HttpOnly` (JavaScript no puede leerlas), `Secure` en producción y
  `SameSite=Strict` (no viajan en peticiones iniciadas por otros sitios).
- El panel renueva el access en silencio cada 12 minutos
  ([SessionKeepAlive.tsx](../../src/components/panel/SessionKeepAlive.tsx)), para que un
  vendedor con el panel abierto no caiga al login cada 15 minutos.

## Renovación con detección de robo (`rotateRefreshToken`)

Cada refresh token tiene un id (`jti`) y una **familia** (`fam`, un inicio de sesión). Ambos
quedan registrados en la tabla `RefreshToken`. Al renovar:

1. Se revisa el estado **actual** del usuario: una cuenta borrada o bloqueada no renueva, y un
   cambio de rol se aplica aquí.
2. Si `tokenVersion` cambió (por "cerrar sesión" o eliminación de la cuenta), el token ya no
   sirve en ningún dispositivo.
3. El token se **consume** con un `UPDATE ... WHERE usedAt IS NULL`: de dos renovaciones
   simultáneas, solo una gana.
4. Si llega un token **ya usado**:
   - **Dentro de 30 segundos** (`REUSE_GRACE_MS`) se responde "carrera" sin revocar. Son dos
     pestañas o la app reintentando.
   - **Pasado ese plazo**, alguien copió el token: se **revoca la familia completa** y se
     registra `REFRESH_TOKEN_REUSE` en la bitácora (RFC 6819 §5.2.2.3).
5. Revocar una familia no cierra las sesiones de otros dispositivos. "Cerrar sesión" sí cierra
   todas, porque incrementa `tokenVersion`
   ([logout/route.ts](../../src/app/api/auth/logout/route.ts)).

Todos estos casos tienen prueba de integración en
[security-dispatch-analytics.test.ts](../../tests/integration/security-dispatch-analytics.test.ts).

## Compra como invitado

[GuestCheckoutGate.tsx](../../src/components/storefront/GuestCheckoutGate.tsx) ofrece
iniciar sesión, crear cuenta o continuar como invitado: solo correo más consentimiento
esencial, con límite de 5 por minuto por IP.

`registerGuest` crea un `CLIENT` con `isGuest = true` y una contraseña aleatoria que nadie
conoce. Si después la persona quiere ver sus pedidos, usa "recuperar contraseña" con ese
correo.

**Si el correo ya tiene cuenta, no se entrega sesión.** Abrir sesión solo con un correo
permitiría ver el historial de otra persona. La respuesta pide iniciar sesión o recuperar la
contraseña.

## Recuperar contraseña y verificar correo

[account-token.service.ts](../../src/lib/services/account-token.service.ts) maneja ambos
flujos:

- El token de 32 bytes aleatorios viaja solo en el enlace del correo. En la base se guarda
  **únicamente su hash SHA-256** ([tokens.ts](../../src/lib/crypto/tokens.ts)), así que quien
  lea la base no puede usarlo.
- El token de recuperación dura 60 minutos; el de verificación, 24 horas.
- Ambos son de un solo uso (`usedAt`).

## Protección de rutas (tres capas)

| Capa | Qué protege | Dónde |
|---|---|---|
| Middleware | Páginas: `/trastienda/*` exige SELLER; `/perfil`, `/pedidos` y `/datos` exigen sesión | [middleware.ts](../../src/middleware.ts) |
| Layout del panel | Vuelve a exigir SELLER al renderizar | [trastienda/layout.tsx](../../src/app/(panel)/trastienda/layout.tsx) |
| Cada acción o ruta | Cada Server Action y route handler revisa sesión y rol por su cuenta (`requireSession`, `requireRole`) | `src/actions/*`, [v1.ts](../../src/lib/api/v1.ts), [rbac.ts](../../src/lib/auth/rbac.ts) |

El middleware no corre en `/api`: cada endpoint se protege a sí mismo. Si alguien olvidara una
capa, las otras siguen funcionando (defensa en profundidad).
