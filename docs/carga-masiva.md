# Carga masiva de productos

Ruta: `/trastienda/productos/importar`. Acceso: cuenta SELLER, opción **Carga masiva** del menú.

1. Descarga la plantilla Excel desde la página. Conserva el diseño de Hachiko y ofrece 100 filas vacías, con SKU y URL automáticos.
2. Completa tus productos, elige un código de lote único y guarda el archivo **XLSX**. Súbelo directamente; no necesitas exportar CSV.
3. Selecciona el archivo y pulsa **Validar archivo**. Esto muestra errores o una vista previa; todavía no escribe en la base de datos.
4. Revisa la vista previa y pulsa **Importar** para crear todos los productos del archivo.

El límite es **1.000 productos y 2 MB por archivo**. En XLSX, el importador busca encabezados de productos entre las primeras 10 filas y prefiere una hoja llamada `Productos`. Reconoce nombres descriptivos como `Nombre *`, `Descripción *`, `Categoría *`, `Precio (CLP) *`, `Stock (un.) *` y `Peso (g) *`. Ignora columnas adicionales. Guarda el libro después de editarlo para actualizar los valores calculados de SKU y URL.

El importador también acepta un CSV UTF-8 existente: admite coma o punto y coma como separador, campos entre comillas, saltos de línea dentro de campos y BOM UTF-8. La página ofrece una sola plantilla descargable, en Excel.

Columnas obligatorias: `nombre, descripcion, categoria, precio_clp, stock, peso_gramos`.

Opcionales: `sku, slug, costo_clp, stock_minimo, nombre_coreano, imagenes, activo, destacado`.

- `categoria`: código (slug) o nombre visible de una categoría activa y no archivada. La página lista las categorías disponibles.
- `sku` y `slug`: si faltan las columnas o están vacías, se generan de forma estable desde nombre y categoría. El mismo producto conserva sus identificadores al validar, confirmar y reintentar. Los valores escritos se respetan. Productos con el mismo nombre y categoría necesitan identificadores explícitos distintos si representan variantes.
- `slug`: identificador único para la URL, solo minúsculas, números y guiones.
- Precios y pesos: enteros positivos sin separadores de miles; stock: entero >= 0.
- `stock_minimo`: 5 por defecto. `activo`: si. `destacado`: no.
- Booleanos: si/no, true/false o 1/0.
- `imagenes`: opcional; URLs HTTPS o rutas locales separadas por `|`. El importador no descarga fotos. Se pueden subir luego desde Editar producto.

Solo crea productos nuevos. SKU y slug duplicados se rechazan. Los errores impiden importar el archivo completo. Al confirmar se repite la validación y se guardan productos, movimientos INITIAL_LOAD y auditoría en una sola transacción serializable. Los índices únicos de la base de datos también protegen frente a importaciones simultáneas. Reintentar un archivo ya importado informa los duplicados.

No requiere migración. Requiere la configuración habitual del proyecto en `.env` y la base de datos migrada. Las categorías de la plantilla deben existir y estar activas en esa base.

Pruebas: `pnpm exec vitest run tests/unit/product-csv.test.ts tests/unit/product-import.test.ts`. Tipos: `pnpm typecheck`.
