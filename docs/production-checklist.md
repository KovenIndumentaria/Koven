# Preparación para producción de KOVEN

## Verificado

- Supabase es la fuente predeterminada del catálogo.
- La `service_role` no está presente en el frontend ni en los archivos de entorno.
- La publishable key utilizada públicamente está protegida por RLS.
- El panel requiere autenticación y pertenencia a `admin_users`.
- El panel incluye `noindex,nofollow`.
- `.env.local`, `node_modules` y `dist` no se versionan.
- El admin compila correctamente para producción.
- `npm audit --omit=dev` informa 0 vulnerabilidades.
- El importador de Google Sheets fue retirado del panel.
- El checkout evita dobles envíos y conserva el carrito ante errores.

## Al elegir hosting y dominio

1. Publicar el catálogo desde la raíz del repositorio.
2. Publicar `admin-app` como un sitio separado usando `npm run build` y `dist`.
3. Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el hosting del admin.
4. Usar HTTPS y un subdominio separado para administración.
5. Agregar cabeceras `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Permissions-Policy` según el proveedor elegido.
6. Configurar el dominio público en Supabase Authentication y revisar las URLs de redirección.
7. Probar login, imágenes, carrito, creación de pedidos y cierre de sesión en las URLs definitivas.
8. Activar protección anti-bots o rate limiting delante de `create_public_order` antes de campañas con tráfico abierto.

## Antes del primer despliegue

- Ejecutar todas las migraciones hasta `202608110023_store_settings_shipping.sql`.
- Crear un commit de corte y conservar el Sheet sin modificaciones.
- Confirmar que el control de datos continúa con 0 errores.
- Completar progresivamente imágenes y costos marcados como advertencias.

## Crear el sitio del panel en Netlify

Esta preparación no modifica ni reemplaza el sitio público existente.

1. En Netlify, elegir **Add new project → Import an existing project** y seleccionar el mismo repositorio de KOVEN.
2. Crear un sitio nuevo, separado del catálogo.
3. Configurar **Base directory** como `admin-app`.
4. Netlify leerá `admin-app/netlify.toml`: ejecutará `npm run build` y publicará `dist`.
5. Agregar en **Project configuration → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
6. No agregar la contraseña del administrador ni una `service_role`.
7. Hacer primero un deploy preview y validar login, navegación, subida de imágenes y cierre de sesión.
8. Recién entonces asignar el subdominio administrativo.

Las cabeceras de seguridad y caché del panel están definidas en `admin-app/netlify.toml`, siguiendo la configuración de headers de Netlify.
