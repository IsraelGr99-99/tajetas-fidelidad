# Caja e inventario del piloto

La migración `supabase/migrations/20261028130000_inventory_checkout.sql` se aplicó al Supabase de pruebas el 26 de octubre de 2026. Se confirmó en el historial remoto y las RPC de caja e inventario responden; falta verificar el flujo con una sesión real de owner/admin y personal de caja. El seed local incluye insumos, recetas y cantidades **DEMO**, no existencias reales.

## Arranque local en Windows

Si Node muestra `UNABLE_TO_VERIFY_LEAF_SIGNATURE` al conectar con Supabase, inicia el servidor usando el almacén de certificados de Windows: `$env:NODE_USE_SYSTEM_CA='1'; npm run start -- -H 0.0.0.0 -p 3001` (o `npm run dev` durante desarrollo). Esta opción mantiene la verificación TLS. No uses `NODE_TLS_REJECT_UNAUTHORIZED=0` ni omitas la validación de certificados. Un HTTP 200 de la app local solo confirma que Next.js funciona; comprueba Supabase Auth y las RPC por separado.

La caja conserva en `sessionStorage` la clave y las líneas de una venta cuya respuesta no se confirmó. Al volver a la misma pestaña, solo permite reintentar esa misma operación; el servidor debe devolver la venta original por idempotencia. No se guarda PII ni la credencial de sesión en ese dato. La venta reciente también puede precargar folio y productos en fidelidad, pero el empleado debe verificar que pertenecen al cliente escaneado; aún no existe conciliación automática entre ambas tablas.

## Fotos y disponibilidad en caja

La migración `20261029130000_product_images_and_stock_reasons.sql` se aplicó al Supabase de pruebas el 26 de octubre de 2026 y se confirmó en el historial remoto. Añade fotos opcionales y muestra los insumos concretos que impiden vender un producto en la sucursal. No cambia saldos ni ventas. En Catálogo, abre un producto y sube una foto JPG, PNG o WebP de hasta 2 MB; también puedes añadirla justo después de crear el producto. Las fotos son públicas: no incluyas personas, documentos ni información privada. Si falta la foto, se muestra una ilustración neutra, no una fotografía inventada. La carga de una foto real y el recorrido autenticado de caja siguen pendientes de prueba manual.

La política de Storage se corrigió en `20261029140000_fix_storage_product_photos.sql` y está aplicada al Supabase de pruebas. Usa una función accesible para el rol autenticado y mantiene la comprobación owner/admin con MFA. La subida real todavía requiere verificación con una sesión de propietario.

Una prueba posterior encontró otro defecto en esa política: `foldername(name)` tomaba `products.name` en lugar de `storage.objects.name`, por lo que incluso el propietario verificado recibía un rechazo de Storage. La migración nueva `20261030110000_fix_storage_photo_path_scoping.sql` califica la columna correcta. Está validada localmente; el propietario informó que la aplicó al Supabase de pruebas el 27 de octubre de 2026, pendiente de comprobar una subida real. El formulario de producto ya permite seleccionar la foto desde el alta; si se guarda el producto pero falla la foto, informa el resultado parcial y permite reintentar sin duplicarlo.

Al vender, caja vuelve a validar inventario en PostgreSQL: la disponibilidad mostrada puede quedar desactualizada si otra caja consume el último insumo. Si la respuesta de la venta no llega, se conserva la clave original y solo se permite reintentar esa operación. Una venta confirmada abre un diálogo central con «Aplicar fidelidad» o «Nueva cuenta».

## Recorrido

1. Entra como owner/admin y abre `/negocio/catalogo`. Carga los productos y sus precios reales; la calculadora de precio es orientativa y no guarda nada.
2. Abre `/negocio/inventario`. Crea insumos o artículos terminados, define la receta de cada producto y registra una carga manual o importa un conteo `.xlsx`/`.csv` por sucursal. La plantilla está en esa pantalla.
3. Comprueba las alertas de mínimo y que cada producto vendible tenga receta y stock suficiente. La vista `/caja` muestra la disponibilidad aproximada por producto; la base comprueba el consumo conjunto del carrito al confirmar.
4. El empleado confirma el cobro físico/externo y registra la venta en `/caja`. En efectivo, la pantalla calcula el cambio. La operación guarda líneas y actor, y descuenta ingredientes de forma atómica e idempotente.
5. Owner/admin revisa `/negocio/ventas` para el total de los últimos 30 días por empleado y las últimas 200 ventas. El reporte es solo de esta caja, **no** incluye ventas importadas de otro POS ni compras de fidelidad.

## Importación de inventario

Columnas: `insumo`, `unidad` (`pieza`, `caja`, `g`, `kg`, `ml`, `l`), `existencia` y `minimo`. Cada archivo aplica un **conteo absoluto** a la sucursal elegida. Repetir el mismo conteo sin cambios no suma stock ni crea otro movimiento. No importes conteos desactualizados mientras se venden artículos: un conteo posterior puede sobrescribir el saldo que dejó la caja.

Para corregir una unidad, abre el insumo en Inventario → «Corregir unidad». «Convertir» actualiza cantidades y recetas de todas las sucursales para `g ↔ kg` o `ml ↔ l` (si la precisión de tres decimales lo permite). «Solo corregir etiqueta» mantiene los números, útil para errores como `g → caja`; obliga a revisar las existencias y recetas antes de volver a vender. Los cambios quedan en un historial inmutable. La migración de snapshots de unidad por movimiento `20261029180000_stock_movement_unit_snapshots.sql` fue aplicada por el propietario al Supabase de pruebas y se confirmó en el historial remoto el 27 de octubre de 2026.

## Impresora ESC/POS

`src/domain/printing/escpos.ts` genera un ticket genérico de 58 u 80 mm. **No hay conexión** con USB, red o Bluetooth ni configuración de codepage/corte/cajón para un modelo concreto. Cuando se conozca marca, modelo, conexión y sistema operativo de la caja, se debe implementar el transporte apropiado y validar físicamente tickets, caracteres, corte y recuperación de fallos. La aplicación no afirma que imprimió.

## Antes de operar con dinero real

- Probar concurrencia, permisos multiempresa y sucursales en PostgreSQL/Supabase real con personal de pruebas.
- Definir devoluciones, anulaciones, arqueo/corte de caja, impuestos, descuentos, propinas y conciliación del pago externo.
- Conciliar cada venta de caja con el folio usado en `/barra` para que la misma visita no se cuente dos veces en reportes. Actualmente son flujos separados.
- Sustituir precios, costos, recetas, mínimos y existencias DEMO por datos aprobados del negocio.
- Completar la revisión de seguridad, respaldo, monitoreo, MFA y prueba de hardware indicados en `docs/hoja-de-ruta.md`.
