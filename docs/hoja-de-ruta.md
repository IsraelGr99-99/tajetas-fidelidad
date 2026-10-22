# Hoja de ruta y criterios de aceptación

| # | Etapa | Estado | Criterio de aceptación verificable |
|---|---|---|---|
| 1 | Fundamentos y documentación | ✅ hecho | `npm run check`, `npm run build` y `npm run test:e2e` pasan; landing accesible (contraste AA, teclado, sin scroll horizontal en móvil) |
| 2 | Esquema, migraciones y ledger | ✅ hecho (local) | Migraciones aplican en PostgreSQL (PGlite); 54 pruebas de reglas, RLS, idempotencia y append-only. **Falta**: aplicar en el proyecto Supabase |
| 3 | Auth, roles, empresa y sucursal | ⏳ | Login/logout del personal; middleware de sesión; selección de sucursal; owner da de alta personal |
| 4 | API de registro y visitas | ⏳ | Registro con OTP por correo; Server Actions con zod; HMAC de ticket; generación de QR; mapeo de códigos de error |
| 5 | Flujos de empleado y cliente | ⏳ | Escaneo QR, confirmación, canje, historial, estados vacíos/carga/error; e2e de cada flujo |
| 6 | QR y NFC | ⏳ | Ruta `/s/<public_id>`; QR con rotación automática; alta de sellos NFC en admin |
| 7 | Apple Wallet y Google Wallet | ⏳ | Adaptadores con estado “no configurado”; con credenciales: pase firmado, web service de Apple, objeto de Google actualizado al cambiar el ledger |
| 8 | Auditoría, hardening y despliegue | ⏳ | Auditoría independiente sin hallazgos altos abiertos; pruebas de concurrencia en Supabase; CSP con nonce; plan de despliegue aprobado |

## Antes del piloto
- [ ] Precios y catálogo reales de Café Nómada (el seed usa precios de ejemplo).
- [ ] Logotipo oficial.
- [ ] SMTP con dominio verificado.
- [ ] Aviso de privacidad revisado legalmente.
- [ ] Pruebas con personal real en la sucursal (QR con cámara del dispositivo de barra).
- [ ] Respaldo y monitoreo de la base (PITR o respaldos diarios).

## Antes de producción
- [ ] Auditoría de seguridad independiente y corrección de hallazgos.
- [ ] Concurrencia probada con varias conexiones.
- [ ] MFA para owner/admin.
- [ ] Emisión pública aprobada en Google Wallet; certificados de Apple vigentes con alertas de caducidad.
- [ ] Limpieza programada de tokens y ventanas de rate limit.
