# Migración de Google Sheets a Supabase

## Estado

La migración se completó el 11 de agosto de 2026. Supabase es la única fuente editable y la fuente predeterminada del catálogo.

- Google Sheets queda congelado como respaldo histórico.
- No existe sincronización bidireccional.
- El importador fue retirado del panel para evitar sobrescrituras accidentales.
- La consulta manual del Sheet requiere `?source=google-sheets` en la URL.
- Productos, precios, variantes, imágenes y stock se administran desde el panel.

## Normalización aplicada

- `buzos` se integró en `abrigos`.
- `jeans` se integró en `pantalones`.
- `medias-boxers`, `boxers` y `medias` se integraron en `medias`.
- Los colores se separaron en nombre y hexadecimal.
- Las variantes se transformaron en filas independientes por color y talle.
- `legacy_sheet_id` conserva la referencia anterior.
- Los productos sin imágenes son válidos y utilizan un placeholder.

## Validación del corte

- Catálogo y detalle de productos consultan Supabase.
- El carrito valida stock mediante Supabase.
- Un pedido de prueba registró correctamente productos, envío y total.
- El panel administrativo recibió y procesó el pedido.
- El control de datos no informó errores de integridad.
