# 7. Calidad y pruebas

Qué se prueba y dónde: [../codigo/13-pruebas.md](../codigo/13-pruebas.md). Las normas de calidad
aplicadas tienen sus propios documentos: [ISO/IEC 25010](../calidad-iso25010.md),
[ISO/IEC 25012](../calidad-datos-iso25012.md), [ISO/IEC 12207](../ciclo-de-vida-iso12207.md),
[IEEE 730](../plan-sqa-ieee730.md) y [CMMI](../procesos-cmmi.md).

## La pirámide de pruebas

```
        ▲  pocas, lentas, realistas
       ╱ ╲        E2E (15): navegador real contra la tienda completa
      ╱───╲
     ╱     ╲      Integración (53): servicios contra PostgreSQL real
    ╱───────╲
   ╱         ╲    Unitarias (240): lógica pura, milisegundos
  ▔▔▔▔▔▔▔▔▔▔▔▔▔  muchas, rápidas, aisladas
```

- **Unitarias:** muchas y rápidas. Prueban una función con entradas y salidas conocidas (el
  total con envío gratis, que un código TOTP no se acepte dos veces, que una bomba zip se
  rechace). Fallan con precisión: dicen exactamente qué se rompió.
- **Integración:** prueban que las piezas funcionan **juntas con la infraestructura real**.
  Son la única forma de probar la concurrencia: un *mock* de la base responde lo que se le
  programa, no aborta transacciones por conflicto como PostgreSQL. Por eso Hachiko las corre
  contra un Postgres real y desechable.
- **E2E (de punta a punta):** pocas y lentas. Prueban lo que vive una persona, como agregar al
  carrito, pagar o entrar al panel, y detectan errores que ninguna otra capa ve. Ejemplo real:
  el formulario mostraba la dirección faltante recién en el segundo intento.

## Por qué no basta con probar a mano

- Las pruebas automáticas **corren en cada cambio** (integración continua) y tardan minutos. Un
  cambio que rompe algo no llega a producción sin que nadie se dé cuenta.
- Las pruebas de concurrencia (cinco compras simultáneas) son **imposibles de reproducir a
  mano** con exactitud.
- Una prueba es **documentación ejecutable**: su nombre dice la regla ("el cliente no puede
  cancelar un pedido ya pagado") y su resultado dice si se cumple.

## Puertas de calidad (*quality gates*)

Cada push pasa por este orden, y si un paso falla, el siguiente no corre:

1. **Tipos** (TypeScript estricto): detecta errores antes de ejecutar.
2. **Lint** (ESLint): detecta patrones problemáticos y malas prácticas.
3. **Auditoría de dependencias:** detecta vulnerabilidades conocidas (CVE) en las librerías.
4. **Unitarias**, luego **integración**, luego **build** de producción.
5. **E2E** en un workflow paralelo.

## Pruebas que protegen al entorno real

- Las pruebas de integración **abortan si la base no es local**, y las e2e **se niegan a correr
  contra un host remoto**. Una prueba que crea pedidos nunca puede ejecutarse por error contra
  la base de producción.
- Las e2e interceptan la llamada a Webpay: prueban que el pedido se creó sin depender de que
  Transbank esté disponible. Las pruebas no son frágiles por culpa de un tercero.

## Regla de regresión

**Todo error corregido deja una prueba que lo habría detectado.** Así el mismo error no puede
volver sin que una prueba falle. Ejemplo: con zod 4, editar solo el precio borraba las fotos del
producto. Hoy lo cubre una prueba unitaria.

## Medir la calidad de un modelo es otra cosa

En software, una prueba pasa o falla. En ML, el modelo **siempre** produce un número: la
pregunta es si es bueno. Por eso el forecast se evalúa con un **backtest** contra una línea base
ingenua (ver [05-datos-y-ml.md](05-datos-y-ml.md)), y la segmentación con silhouette. Son
métricas, no pruebas de aprobado o reprobado.
