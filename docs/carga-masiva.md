# Carga masiva de productos

Ruta: `/trastienda/productos/importar`. Acceso: cuenta SELLER, opción **Carga masiva** del menú.

1. Descarga la plantilla Excel desde la página. Conserva el diseño de Hachiko y ofrece 100 filas vacías.
2. Para crear un producto, completa sus datos y elige un código de lote único: el SKU y la URL se calculan solos. Para reponer uno existente, indica su SKU en **SKU existente** y la cantidad que quieres **sumar** en **Stock**; deja el resto de esa fila vacío.
3. Guarda el archivo **XLSX** y súbelo directamente; no necesitas exportar CSV.
4. Pulsa **Validar archivo**. La vista previa distingue productos nuevos y reposiciones; todavía no escribe en la base de datos.
5. Revisa las cantidades y confirma la carga. Un error en cualquier fila cancela toda la operación.

El límite es **1.000 productos y 2 MB por archivo**. En XLSX, el importador busca encabezados de productos entre las primeras 10 filas y prefiere una hoja llamada `Productos`. Reconoce nombres descriptivos como `Nombre *`, `Descripción *`, `Categoría *`, `Precio (CLP) *`, `Stock / sumar *` y `Peso (g) *`. Ignora columnas adicionales. Guarda el libro después de editarlo para actualizar los valores calculados de SKU y URL.

El importador también acepta un CSV UTF-8 existente: admite coma o punto y coma como separador, campos entre comillas, saltos de línea dentro de campos y BOM UTF-8. La página ofrece una sola plantilla descargable, en Excel.

Para productos nuevos son obligatorias `nombre, descripcion, categoria, precio_clp, stock, peso_gramos`. Para reponer stock basta `sku` y `stock` (cantidad positiva que se suma). En la plantilla Excel, el SKU existente se escribe en la última columna amarilla.

Opcionales: `sku, slug, costo_clp, stock_minimo, nombre_coreano, imagenes, activo, destacado`.

- `categoria`: código (slug) o nombre visible de una categoría activa y no archivada. La página lista las categorías disponibles.
- `sku` y `slug`: para productos nuevos se generan desde el nombre y la categoría si están vacíos. El SKU existente funciona como identificador del producto al reponer stock; esta carga no maneja tallas ni variantes.
- `slug`: identificador único para la URL, solo minúsculas, números y guiones.
- Precios y pesos: enteros positivos sin separadores de miles; stock: entero >= 0.
- `stock_minimo`: 5 por defecto. `activo`: si. `destacado`: no.
- Booleanos: si/no, true/false o 1/0.
- `imagenes`: opcional; URLs HTTPS o rutas locales separadas por `|`. El importador no descarga fotos. Se pueden subir luego desde Editar producto.

Un SKU nuevo crea un producto; un SKU existente suma stock sin cambiar nombre, precio, categoría ni fotos. El slug de un producto nuevo no puede pertenecer a otro SKU. Los errores impiden importar el archivo completo. Al confirmar se repite la validación y se guardan productos, movimientos `INITIAL_LOAD` o `RESTOCK` y auditoría en una sola transacción serializable. **Volver a importar el mismo archivo de reposición volverá a sumar el stock**: conserva una copia de cada lote aplicado.

No requiere migración. Requiere la configuración habitual del proyecto en `.env` y la base de datos migrada. Las categorías de la plantilla deben existir y estar activas en esa base.

Pruebas: `pnpm exec vitest run tests/unit/product-csv.test.ts tests/unit/product-import.test.ts`. Tipos: `pnpm typecheck`.
