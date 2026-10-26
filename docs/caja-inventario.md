# Caja e inventario del piloto (base local)

Esta funcionalidad todavía no está habilitada en el Supabase remoto. Primero revisa y aplica `supabase/migrations/20261028130000_inventory_checkout.sql` en un entorno de pruebas; después verifica el acceso con personal real. El seed local incluye insumos, recetas y cantidades **DEMO**, no existencias reales.

## Arranque local en Windows

Si Node muestra `UNABLE_TO_VERIFY_LEAF_SIGNATURE` al conectar con Supabase, inicia el servidor usando el almacén de certificados de Windows: `$env:NODE_USE_SYSTEM_CA='1'; npm run start -- -H 0.0.0.0 -p 3001` (o `npm run dev` durante desarrollo). Esta opción mantiene la verificación TLS. No uses `NODE_TLS_REJECT_UNAUTHORIZED=0` ni omitas la validación de certificados. Un HTTP 200 de la app local solo confirma que Next.js funciona; comprueba Supabase Auth y las RPC por separado.

La caja conserva en `sessionStorage` la clave y las líneas de una venta cuya respuesta no se confirmó. Al volver a la misma pestaña, solo permite reintentar esa misma operación; el servidor debe devolver la venta original por idempotencia. No se guarda PII ni la credencial de sesión en ese dato. La venta reciente también puede precargar folio y productos en fidelidad, pero el empleado debe verificar que pertenecen al cliente escaneado; aún no existe conciliación automática entre ambas tablas.

## Recorrido

1. Entra como owner/admin y abre `/negocio/catalogo`. Carga los productos y sus precios reales; la calculadora de precio es orientativa y no guarda nada.
2. Abre `/negocio/inventario`. Crea insumos o artículos terminados, define la receta de cada producto y registra una carga manual o importa un conteo `.xlsx`/`.csv` por sucursal. La plantilla está en esa pantalla.
3. Comprueba las alertas de mínimo y que cada producto vendible tenga receta y stock suficiente. La vista `/caja` muestra la disponibilidad aproximada por producto; la base comprueba el consumo conjunto del carrito al confirmar.
4. El empleado confirma el cobro físico/externo y registra la venta en `/caja`. En efectivo, la pantalla calcula el cambio. La operación guarda líneas y actor, y descuenta ingredientes de forma atómica e idempotente.
5. Owner/admin revisa `/negocio/ventas` para el total de los últimos 30 días por empleado y las últimas 200 ventas. El reporte es solo de esta caja, **no** incluye ventas importadas de otro POS ni compras de fidelidad.

## Importación de inventario

Columnas: `insumo`, `unidad` (`pieza`, `g`, `kg`, `ml`, `l`), `existencia` y `minimo`. Cada archivo aplica un **conteo absoluto** a la sucursal elegida. Repetir el mismo conteo sin cambios no suma stock ni crea otro movimiento. No importes conteos desactualizados mientras se venden artículos: un conteo posterior puede sobrescribir el saldo que dejó la caja.

## Impresora ESC/POS

`src/domain/printing/escpos.ts` genera un ticket genérico de 58 u 80 mm. **No hay conexión** con USB, red o Bluetooth ni configuración de codepage/corte/cajón para un modelo concreto. Cuando se conozca marca, modelo, conexión y sistema operativo de la caja, se debe implementar el transporte apropiado y validar físicamente tickets, caracteres, corte y recuperación de fallos. La aplicación no afirma que imprimió.

## Antes de operar con dinero real

- Aplicar la migración y probar concurrencia, permisos multiempresa y sucursales en PostgreSQL/Supabase real.
- Definir devoluciones, anulaciones, arqueo/corte de caja, impuestos, descuentos, propinas y conciliación del pago externo.
- Conciliar cada venta de caja con el folio usado en `/barra` para que la misma visita no se cuente dos veces en reportes. Actualmente son flujos separados.
- Sustituir precios, costos, recetas, mínimos y existencias DEMO por datos aprobados del negocio.
- Completar la revisión de seguridad, respaldo, monitoreo, MFA y prueba de hardware indicados en `docs/hoja-de-ruta.md`.
