# Sistema de diseño · app de Hachiko

**Vitrina Shiba, en el bolsillo.** Es la identidad de la web (crema, mantequilla, naranja Shiba y tinta café) llevada al celular, con un modo noche café cálido.

La estructura sigue **Material 3** (Android primero): roles de color, escala tipográfica, forma, elevación, capas de estado y el catálogo de componentes. La apariencia no es la de Material, sino la de la marca. Algunos detalles vienen de otras fuentes cuando calzan mejor con el concepto:

- hojas y gestos más suaves, al estilo de iOS;
- motivos de papelería coreana: el timbre y el cartón punteado.

| Archivo | Qué es |
|---|---|
| `styles.css` | **Fuente de verdad**: tokens (`:root` claro y `:root[data-theme='dark']` noche) y clases de componentes |
| `index.html` | Guía viva: fundamentos y catálogo completo. Incluye Dev Mode (inspector) y **Copy as prompt** (React Native primero) |
| `concept.html` | Tres pantallas de muestra (inicio, detalle de producto, "Hoy" del vendedor) armadas solo con componentes |
| `icons.html` | Sprite SVG de íconos (contorno estilo Material, trazo 2). Nunca emoji |

Para abrirlo, haz doble clic en `index.html`. No necesita servidor.

## Reglas

1. **Cada relleno viene con su texto pareado** (`--on-*`). El contraste se calcula con la fórmula WCAG:
   - textos: ≥ 4.5:1;
   - bordes y controles: ≥ 3:1.

   La tabla está en `index.html` → Color y se calcula sola desde los tokens.
2. **El texto sobre naranja es café**, nunca blanco (5.8:1). Blanco sobre naranja da 2.2:1 y no se lee.
3. **El naranja es color de relleno.** Para bordes, la selección o el foco se usa `--primary-strong` (3.9:1).
4. **Los neutros y las sombras van teñidos de café**, nunca gris puro ni negro.
5. **Áreas táctiles de 48 dp como mínimo.** Hay que respetar "reducir movimiento" y el tamaño de letra del sistema.
6. **Un solo momento expresivo por pantalla**: el timbre, el saludo grande o una foto a sangre completa. El resto queda sereno.

## Cómo extenderlo

- **Token nuevo**: agrégalo en el grupo que corresponde de `:root` **y** en el bloque noche. Úsalo por nombre, nunca como valor suelto.
- **Componente nuevo**: necesita tres cosas en `index.html`:
  - una clase en `styles.css`, construida solo con tokens;
  - una `<section id="clave">` con todas sus variantes y estados;
  - una entrada `SPECS.clave`. Con eso aparece solo en Dev Mode y en Copy as prompt.
- **Otro tema**: copia el bloque `:root[data-theme='dark']` con otro nombre y cambia solo los valores. Los componentes no se tocan.

## De aquí a la app (React Native + Expo)

- Los tokens van en `mobile/src/theme/tokens.ts`, con objetos `light` y `dark` de los mismos nombres. El modo sigue a `useColorScheme()` y se puede forzar desde Cuenta.
- Cada componente de la guía tiene su archivo en `mobile/src/ui/` (la ruta sale en el inspector).
- Las sombras usan `elevation` en Android y `shadow*` en iOS, a partir de los mismos niveles 0–5.
- Las tipografías Zen Maru Gothic y Quicksand se cargan con `expo-font`.
