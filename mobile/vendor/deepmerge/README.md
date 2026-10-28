# deepmerge 4.3.1 parchado

Copia de [deepmerge](https://github.com/TehShrike/deepmerge) 4.3.1 (licencia MIT,
ver `license.txt`) con **una sola corrección**: descarta la clave `"__proto__"`
al copiar el objeto de destino. Sin ella, un objeto con esa clave propia (por
ejemplo, salido de `JSON.parse`) cambiaba el prototipo del resultado
(*prototype poisoning*, [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)).

## Por qué existe

- El aviso **no tiene versión corregida publicada** (afecta `>=4.2.0`, incluida la última).
- En la app lo usa solo `@expo/config` (herramienta del computador que combina
  `app.json` con los plugins; no viaja al teléfono).
- `mobile/package.json` lo instala en su lugar con `overrides`.

El cambio está marcado con `Parche Hachiko` en `index.js` y lo prueba
`tests/unit/deepmerge-patch.test.ts`.

## Cuándo quitarlo

Cuando deepmerge publique una versión corregida (o Expo deje de usarlo): borra
esta carpeta y la línea `"deepmerge"` de `overrides` en `mobile/package.json`, y
corre `npm audit` en `mobile/` para confirmar.
