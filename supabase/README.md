# Supabase de KOVEN

Las migraciones se aplican en orden desde `supabase/migrations`.

## Alta del primer administrador

1. Crear manualmente el usuario `koven.ind@gmail.com` en Supabase Authentication.
2. Obtener su UUID.
3. Ejecutar una sola vez, desde SQL Editor con privilegios de proyecto:

```sql
insert into public.admin_users (user_id)
values ('UUID_DEL_USUARIO');
```

No existe registro público. La clave `service_role` no debe copiarse al frontend ni a archivos `.env` de Vite.

## Estado de esta fase

- El catálogo público todavía usa Google Sheets.
- El panel utiliza solamente la URL y la publishable key de Supabase.
- Las funciones de stock, compras y ventas verifican que el usuario esté en `admin_users`.
- Las operaciones críticas actualizan stock e historial dentro de una misma transacción.
