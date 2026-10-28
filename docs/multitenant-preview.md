# Prueba local del primer corte multiempresa

Este corte está destinado a validar aislamiento y flujo de propietario con negocios ficticios. No habilita contrataciones ni registro público de clientes de un negocio nuevo.

1. Ejecutar `npm run check`, `npm run build` y `npm run test:e2e` en la rama de trabajo.
2. Antes de aplicar `20261030130000_multi_business_demo_onboarding.sql` al Supabase de pruebas compartido: tomar y verificar un respaldo nuevo de esquema y datos, revisar migraciones pendientes con `npx supabase migration list --linked` y confirmar que se aplica solo lo previsto. No restaurar volcados encima de producción; la restauración requiere ensayo separado.
3. Iniciar sesión como propietario con correo verificado y TOTP (`aal2`). En **Mi cuenta → Agregar otro negocio de prueba**, crear una empresa ficticia. La base crea la sucursal Principal, una campaña de cinco sellos y un producto DEMO de $50 MXN. Todo debe personalizarse antes de uso real.
4. Comprobar que se puede alternar entre los dos negocios desde **Mi cuenta**; al cambiar, solo aparecen la sucursal, catálogo, clientes y reportes del negocio activo. Si no hay negocio seleccionado, `/seleccionar-negocio` exige elegir uno.
5. Abrir `/c/<slug>`: la vista pública es ilustrativa. El registro de clientes del negocio nuevo está deshabilitado hasta contar con aviso de privacidad y consentimiento específicos. No configurar `ENABLE_MULTI_BUSINESS_ENROLLMENT=true` en producción sin esa revisión.

La migración no se aplica al proyecto remoto como parte de este cambio. Se debe probar el recorrido con dos cuentas/negocios ficticios en un entorno controlado antes de integrarla o publicarla.
