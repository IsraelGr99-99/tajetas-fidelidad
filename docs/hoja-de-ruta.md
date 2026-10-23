# Hoja de ruta y criterios de aceptación

| # | Etapa | Estado | Criterio de aceptación verificable |
|---|---|---|---|
| 1 | Fundamentos y documentación | ✅ hecho | `npm run check`, `npm run build` y `npm run test:e2e` pasan; landing accesible (contraste AA, teclado, sin scroll horizontal en móvil) |
| 2 | Esquema, migraciones y ledger | ✅ hecho | Migraciones aplicadas en Supabase con `db lint` sin errores; pruebas de reglas, RLS, idempotencia y append-only en PGlite |
| 3 | Auth, roles, empresa y sucursal | ✅ hecho | Login/logout del personal, `proxy.ts` de sesión, contexto de roles (`get_staff_context`), selección de sucursal, páginas de “sin acceso”. **Falta**: alta de personal desde la UI (etapa 5, administración) y MFA |
| 4 | Registro de clientes y QR | ✅ hecho | Acceso con OTP por correo (teléfono listo tras activar SMS), alta con aviso de privacidad, tarjeta con sellos e historial, QR temporal de identificación y de canje, HMAC de ticket, mensajes por código de error. **Falta**: prueba manual de envío real de correo |
| 5 | Flujos de empleado y cliente | ✅ hecho | Visita y canje con QR; bitácora y reversos con motivo; administración con resumen real, catálogo, campaña versionada, personal por invitación, sucursales, búsqueda de clientes y ajustes; baja de cuenta del cliente. **Falta**: e2e con sesión real (requiere cuentas de prueba) |
| 5b | Rediseño y finanzas | ✅ hecho | Navegación con rutas cortas y barra unificada con apartado; tarjeta en vivo; importación Excel/CSV de catálogo, ventas POS y gastos; costos; panel de ventas, ganancias, gastos y sucursales; datos DEMO rotulados; código del personal solo a correos autorizados |
| 6 | QR y NFC | ⏳ | Ruta `/s/<public_id>`; QR con rotación automática; alta de sellos NFC en admin |
| 7 | Apple Wallet y Google Wallet | ⏳ | Adaptadores con estado “no configurado”; con credenciales: pase firmado, web service de Apple, objeto de Google actualizado al cambiar el ledger |
| 8 | Auditoría, hardening y despliegue | ⏳ | Auditoría independiente sin hallazgos altos abiertos; pruebas de concurrencia en Supabase; CSP con nonce; plan de despliegue aprobado |

## Antes del piloto
- [ ] Precios y catálogo reales de Café Nómada (el seed usa precios de ejemplo).
- [ ] Logotipo oficial.
- [ ] SMTP con dominio verificado.
- [ ] Aviso de privacidad revisado legalmente (borrador en `/privacidad` con datos “por completar”).
- [ ] Pruebas con personal real en la sucursal (QR con cámara del dispositivo de barra).
- [ ] Respaldo y monitoreo de la base (PITR o respaldos diarios).

## Antes de producción
- [ ] Auditoría de seguridad independiente y corrección de hallazgos.
- [ ] Concurrencia probada con varias conexiones.
- [ ] MFA para owner/admin.
- [ ] Emisión pública aprobada en Google Wallet; certificados de Apple vigentes con alertas de caducidad.
- [ ] Limpieza programada de tokens y ventanas de rate limit.
