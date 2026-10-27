# Demo guiada de Loyalty

La portada puede ser pública; la consola del Supabase de pruebas actual debe permanecer bajo inicio de sesión y acceso por invitación. Las cuentas de clientes de prueba pueden contener datos personales y no forman parte de los datos ficticios. No entregar acceso de propietario o administrador a prospectos.

## Qué enseñar en cinco minutos

1. Entra como propietario y abre `/inicio`. El bloque «Recorrido de demostración» enlaza catálogo, inventario, caja e indicadores.
2. Enseña productos de cafetería con variantes y precios de ejemplo. El seed prepara 15 productos, 10 insumos, recetas y stock de una sucursal; un croissant queda por debajo del mínimo para demostrar alertas. Todo producto añadido para la presentación lleva «DEMO» en el nombre. Los cinco productos iniciales conservan «(ejemplo)».
3. Muestra el inventario y cómo una venta descontaría ingredientes. Si haces una venta de prueba en caja, indícalo explícitamente: esa operación se guarda en el historial y afecta stock; **no** es una simulación desechable.
4. Desde `/inicio`, genera los reportes de 60 días. Son ventas importadas y gastos sintéticos, marcados DEMO y removibles desde el mismo control. No generan clientes, sellos, ventas de caja ni pagos reales.
5. Muestra el diseño de tarjeta y la vista del cliente usando una cuenta de prueba controlada. No muestres información de otras personas.

## Cargar el catálogo al Supabase de pruebas actual

En el proyecto actual, la migración `20261030120000_demo_catalog.sql` carga solo los registros de ejemplo faltantes si Café Nómada sigue marcado como demo. El seed ampliado se reserva para proyectos nuevos. Antes de aplicar la migración, confirma el proyecto enlazado y crea un respaldo **nuevo** de esquema y datos en `.local-backups/`, que está ignorado por Git y puede contener datos personales. No reutilices nombres de respaldo anteriores. Desde PowerShell, en la raíz del repositorio:

```powershell
npx supabase migration list --linked
npx supabase db dump --linked --file .local-backups/pre-demo-catalog-20261027-schema.sql
npx supabase db dump --linked --data-only --use-copy --file .local-backups/pre-demo-catalog-20261027-data.sql
Get-Item .local-backups/pre-demo-catalog-20261027-*.sql | Select-Object Name, Length
npx supabase db push --linked --dry-run
```

Si los nombres de archivo ya existen, usa otros nuevos. Comprueba que cada comando terminó bien, que los dos archivos no están vacíos y que el historial remoto contiene las migraciones de catálogo y fotos. El `dry-run` debe mostrar **únicamente** `20261030120000_demo_catalog.sql`; si hay otras pendientes, detente. Después ejecuta `npx supabase db push --linked` y verifica de nuevo `npx supabase migration list --linked`. No ejecutes `db reset` remoto. Comprueba en `/negocio/catalogo` y `/negocio/inventario` que aparecen los datos nuevos; si la migración falla, revisa el error y no repitas a ciegas.

## Antes de compartir un enlace

- Verifica `npm run check` y `npm run build`, configuración de dominio HTTPS, Auth redirects, SMTP, CAPTCHA y MFA de propietarios.
- Revisa privacidad y datos existentes en el proyecto de pruebas; nunca uses una cuenta con acceso a información personal para una visita externa.
- Valida registro, correo, QR, caja, fidelidad y stock con cuentas y tickets de prueba. Distingue el resultado real de lo que todavía está no configurado.
- No presentes cobro integrado, impresión ESC/POS ni Apple Wallet como funciones disponibles. Consulta [despliegue](despliegue.md) y [seguridad](seguridad.md).
