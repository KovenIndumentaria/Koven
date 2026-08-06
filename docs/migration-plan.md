# Migración de Google Sheets a Supabase

## Reglas de corte

- Google Sheets se conserva como fuente pública hasta validar Supabase.
- No se migran URLs ni archivos de imágenes.
- Solo se importan filas con `id` y `nombre` válidos.
- `legacy_sheet_id` conserva el identificador anterior.
- El stock se guarda únicamente en `product_variants.stock_current`.
- Las filas vacías, columnas desconocidas y valores de credenciales se excluyen.

## Normalización inicial

- `buzos` se integra en `abrigos`.
- `jeans` se integra en `pantalones`.
- `medias-boxers`, `boxers` y `medias` se integran en `medias`.
- `colores` se separa en nombre y hexadecimal.
- `variantes` se transforma de `Color:Talle:Cantidad` a filas independientes.
- Los productos sin imágenes continúan siendo válidos y usan placeholder.

## Validaciones antes del corte

- Cantidad de productos migrados.
- Precios comparados por `legacy_sheet_id`.
- Variantes y stock comparados por producto.
- Productos activos e inactivos.
- Categorías y filtros públicos.
- Producto sin imagen.
- Carrito y finalización por WhatsApp.

Después del corte, Supabase será la única fuente editable. No habrá sincronización bidireccional.
