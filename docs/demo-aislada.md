# Proyecto de demostración aislado

La demostración de Loyalty debe vivir en un proyecto Supabase **nuevo**. El proyecto actual del piloto se conserva sin borrar ventas, clientes, personal, Storage ni historial inmutable. No se debe ejecutar `supabase/demo/seed.sql` sobre el proyecto del piloto.

## Estado de la base DEMO

En el proyecto nuevo `sbmgiltyeopellshnotq`, los seeds transaccionales `seed.sql` y `seed-rich.sql` se ejecutaron correctamente desde el SQL Editor. La consulta de verificación confirmó exactamente dos empresas: Norte Barber Studio y Brisa Helados. Cada una tiene dos sucursales, 14 productos, 1680 líneas de ventas importadas sintéticas y 60 gastos sintéticos. Norte tiene 12 insumos y 22 componentes de receta; Brisa, 13 insumos y 29 componentes. Ningún producto quedó sin receta y los reportes cuadran con sus renglones. No hay clientes inventados. El usuario de propietario del proyecto nuevo tiene correo verificado y quedó vinculado como `owner` activo en ambas empresas. La consulta a `auth.mfa_factors` aún no mostró ningún factor para ese usuario: debe activar el segundo factor desde Loyalty, independiente del MFA usado para entrar al dashboard de Supabase. El proyecto anterior no se modificó.

## Contenido preparado

- `supabase/demo/seed.sql` seguido de `supabase/demo/seed-rich.sql`: Norte Barber Studio y Brisa Helados; dos sucursales por empresa; 28 productos, 25 insumos, 51 componentes de receta, existencias por sucursal y 60 días de reportes sintéticos de ventas importadas y gastos. La segunda carga no duplica registros al repetirla.
- `public/demo/*.webp`: cuatro fotos originales para miniaturas de productos representativos. Son recursos locales del sitio; todavía no están subidos a Storage ni asociados como `image_path` de la base. Si el propietario sube una foto real, esa imagen tiene prioridad.
- Los importes y nombres de las empresas son ficticios. Se guarda `is_demo=true` en empresas, importaciones, líneas y gastos. La consola avisa globalmente que son datos de demostración. No se inventan clientes ni tickets de caja.
- Ambos seeds son reejecutables: no duplican catálogo, recetas, existencias ni reportes del mismo periodo. Van en transacciones y abortan si la base contiene alguna empresa ajena a estas dos.

## Activación y pendientes

1. Hecho: proyecto nuevo creado, enlace CLI apuntando a `sbmgiltyeopellshnotq`, migraciones aplicadas y ambos seeds verificados. La contraseña de base y las claves se guardan **por separado**; no pegarlas en el chat ni versionarlas. Auth no copia automáticamente usuarios, contraseñas ni MFA del proyecto anterior.
2. Hecho: usuario propietario con correo verificado, vinculado como `owner` activo a ambas empresas. Pendiente: activar y verificar MFA de Supabase Auth desde Cuenta en Loyalty; el factor del dashboard no cuenta para la app. No guardar el UUID ni secretos en archivos versionados.
3. Opcionalmente, invitar dos cuentas de personal de prueba controladas por ti desde Auth; con sus UUID verificados, establecer también `app.demo_norte_manager_user_id` y `app.demo_brisa_manager_user_id` antes de ejecutar el script. Quedarán como responsables de Centro y Cholula. No fabricar correos personales ni dar acceso público a la consola. Hasta que haya cuentas de prueba y ventas creadas en caja, el historial por empleado estará vacío; los reportes precargados son importaciones sintéticas por sucursal, no ventas de empleados.
4. Configurar un despliegue **separado** para la demo con URL/clave pública del proyecto nuevo (variables de Hostinger, nunca `.env.local` versionado). Para la ruta genérica `/tarjeta/acceso`, compilar con `NEXT_PUBLIC_BUSINESS_SLUG=norte-barber-studio` o cambiarla por la empresa elegida. Mantener `ENABLE_MULTI_BUSINESS_ENROLLMENT` desactivado hasta contar con aviso de privacidad y consentimiento específicos para cada negocio. No sustituir sin coordinación el despliegue que aún atiende las rutas del piloto.
5. Validar inicio de sesión, selección entre empresas y sucursales, caja, inventario, reportes y aislamiento de datos. No conectar pagos ni impresoras reales a esta demo.

## Verificación antes de publicar

- El proyecto viejo sigue ligado a sus clientes y conserva sus rutas antiguas; no se borran ni renombran datos reales.
- `norte-barber-studio` no puede leer `brisa-helados` y viceversa mediante sesión de personal.
- Las miniaturas que no tengan foto propia muestran un marcador de posición. Las fotos locales son solo de los productos mapeados; no se afirma que las 12 fotos están cargadas.
- El banner global de demostración se mantiene visible, aunque los productos no llevan el sufijo “DEMO”.
- Si se quiere representar ventas por empleado, se necesitarán cuentas de personal de prueba y transacciones sintéticas hechas mediante las funciones de caja; los reportes importados no atribuyen ventas a personas.
