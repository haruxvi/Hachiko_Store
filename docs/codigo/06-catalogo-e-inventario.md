# 6. Catálogo e inventario

Archivos centrales: [catalog.service.ts](../../src/lib/services/catalog.service.ts),
[catalog-admin.ts](../../src/lib/catalog-admin.ts),
[inventory.service.ts](../../src/lib/services/inventory.service.ts),
[product-import.ts](../../src/lib/product-import.ts),
[upload-guard.ts](../../src/lib/upload-guard.ts),
[product-image.ts](../../src/lib/product-image.ts).

## El producto

| Campo | Para qué |
|---|---|
| `sku`, `slug` | Identificadores únicos: el SKU para la operación, el slug para la URL |
| `priceCLP`, `costCLP` | Precio de venta y costo. El costo es opcional y permite calcular el margen |
| `stock` | Unidades **físicas** en bodega |
| `lowStockThreshold` | Umbral de "stock bajo", que dispara alertas y el estado `low` de la API |
| `active`, `archivedAt` | Visible u oculto. Archivar reemplaza al borrado (ver abajo) |
| `weightGrams`, `images`, `featured`, `nameKorean` | Datos de catálogo |

**Archivar en lugar de borrar.** Un producto o una categoría se archivan y se pueden restaurar.
Una categoría solo se elimina si no tiene productos activos. Así los pedidos antiguos siguen
apuntando a productos que existen.

## Stock físico, reservado y disponible

```
disponible = stock físico − reservas vigentes de otros pedidos
```

- **Físico** (`Product.stock`): solo cambia con movimientos registrados, nunca "a mano" en la
  base.
- **Reservado** (`StockReservation`): unidades apartadas por un pedido que aún no se paga.
  Vencen a los 15 minutos.
- **Disponible:** lo que se puede vender ahora (`getAvailableStock`). Es lo que ve el cliente y
  lo que usa el pipeline de reposición.

## Libro de movimientos (`StockMovement`)

Cada cambio de stock queda registrado con tipo (`IN` / `OUT`), motivo, cantidad con signo, stock
anterior, stock resultante, pedido relacionado y actor.

| Motivo | Cuándo |
|---|---|
| `SALE` | Pago confirmado (`deductStockForOrder`) |
| `RESTOCK`, `INITIAL_LOAD` | Reposición o carga inicial (también desde la carga masiva) |
| `CORRECTION_UP`, `CORRECTION_DOWN` | Ajuste manual por conteo |
| `DAMAGED`, `EXPIRED` | Mermas, que alimentan la vista "Qué reponer → Mermas" |
| `RETURNED` | Producto devuelto que vuelve a la venta |
| `EXCHANGE` | Unidad nueva entregada por un cambio |

Los ajustes manuales (`adjustStock`) corren en una transacción Serializable y además guardan un
`StockAdjustment` con stock anterior, stock nuevo, delta, motivo, nota y vendedor. Con el libro
se puede **reconstruir el stock de cualquier día** y explicar cada diferencia. El historial de
90 días de un producto se obtiene con `getProductStockHistory`.

## Historial de precios (`PriceHistory`)

Cuando un vendedor cambia el precio de un producto, se guarda una fila con precio anterior,
precio nuevo, vendedor y fecha (`updateProduct` en
[catalog.service.ts](../../src/lib/services/catalog.service.ts)). La tabla es **append-only**:
no se edita ni se borra. Sirve como auditoría y como base de la elasticidad-precio (ver
[machine-learning.md](../machine-learning.md)).

## Carga masiva (CSV o Excel)

Guía de uso: [carga-masiva.md](../carga-masiva.md). Por dentro:

1. **Límites:** 2 MB por archivo, 1.000 productos y 30 cargas cada 10 minutos por vendedor.
2. **Revisión del archivo antes de abrirlo** ([upload-guard.ts](../../src/lib/upload-guard.ts)).
   Un `.xlsx` es un ZIP con XML adentro, así que se rechazan:
   - **bombas zip:** se descomprime de verdad con tope de salida (15 MB por entrada y 25 MB en
     total), sin confiar en los tamaños que declara el ZIP;
   - macros, objetos incrustados (OLE/ActiveX), conexiones externas y vínculos a otros libros;
   - XML con `DOCTYPE` o `ENTITY` (XXE, "billion laughs");
   - ejecutables, PDF o HTML renombrados.

   El archivo **nunca se guarda ni se ejecuta**: solo se leen los valores de las celdas.
3. **Inyección de fórmulas:** un texto que empieza con `=`, `+`, `@` o similares se trata como
   sospechoso ([formula-guard.ts](../../src/lib/formula-guard.ts)). Así, si los datos se exportan
   después a Excel, no se ejecutan como fórmula.
4. **Vista previa:** se valida cada fila y se muestran los errores antes de guardar.
5. **Guardado en una transacción Serializable.** Se crean los productos nuevos y se **suma**
   stock a los existentes por SKU, con su movimiento de inventario. Todo o nada.

## Fotos de productos

[product-image.ts](../../src/lib/product-image.ts):

- **Se verifica el tipo real del archivo por su firma (magic bytes)**: PNG, JPEG o WebP. El
  `Content-Type` que declara el navegador no se toma en cuenta.
- Se sube a Vercel Blob con un nombre aleatorio (`productos/<uuid>.<ext>`). El nombre original
  nunca se usa.
- Límite de 40 subidas por minuto.

## Frescura de los datos

- La tienda se renderiza **en cada petición**: el layout de `(storefront)` y la portada declaran
  `dynamic = 'force-dynamic'`. Por eso el stock y el precio que ve el cliente siempre son los
  actuales.
- En la trastienda, las páginas operativas (productos, inventario, categorías) usan
  `revalidate = 0`. Las de inteligencia se pueden cachear hasta 60 segundos, porque sus datos
  cambian una vez al día.
- Después de una mutación, las Server Actions llaman a `revalidatePath` sobre las páginas
  afectadas (por ejemplo, `/trastienda/inventario` tras un ajuste).
- `revalidateStock` también purga las etiquetas `product:<id>`, `catalog` e `inventory`. Hoy
  ninguna lectura usa esas etiquetas, así que es una preparación para cuando se agregue caché
  por etiqueta; no cambia el comportamiento actual.
