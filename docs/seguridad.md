# Seguridad: modelo de amenazas, controles y auditoría

## Auditoría independiente (2026-10-28)

Un agente auditor revisó en modo de solo lectura las migraciones, el proxy, las Server Actions, la integración con Wallet y las cabeceras. También ejecutó pruebas propias contra PGlite. **No encontró hallazgos críticos ni altos.** Estos fueron los hallazgos y su estado:

| Id | Severidad | Hallazgo | Estado |
|---|---|---|---|
| M1 | Media | El personal podía acreditarse sellos en su propia tarjeta de cliente | ✅ `self_service_forbidden` al apartar, acreditar y canjear |
| M2 | Media | Tras eliminar la cuenta, el pase de Google Wallet seguía activo y con el nombre | ✅ La versión de la tarjeta se incrementa y el pase se sincroniza (inactivo, sin nombre) |
| M3 | Media | Abuso del envío de códigos (agotar el cupo de correos o SMS) | 🟡 CAPTCHA Turnstile listo en la app. **Falta activarlo en Supabase** (ver despliegue) |
| M4 | Media | Owner/admin solo con contraseña | ✅ MFA TOTP opcional: con un factor verificado, administrar exige sesión `aal2`. 🟡 Hacerlo obligatorio antes de producción |
| B1 | Baja | Usuarios ajenos llenaban la bitácora de la empresa | ✅ Rechazos ajenos se guardan sin empresa, con límite por usuario; IP tomada de la cabecera del proveedor |
| B2 | Baja | Carrera en "último owner" y "última sucursal activa" | ✅ Bloqueo de filas antes de contar |
| B3 | Baja | El tiempo de respuesta revelaba qué correos son del personal | ✅ El envío ocurre después de responder (`after`) |
| B4 | Baja | Cambiar la regla emitía recompensas en masa | ✅ Como máximo una recompensa por evento |
| B5 | Baja | Datos demo mezclados, sucursal demo reactivable, `setseed` | ✅ Sucursal demo bloqueada y sin `setseed`. ℹ️ El panel incluye DEMO por defecto, con aviso y botón para ocultarlo (decisión para presentar) |
| B6 | Baja | Folio único por empresa y no por sucursal | ✅ El HMAC incluye la sucursal |
| B7 | Baja | CSP sin `script-src` | ✅ CSP con nonce por petición en `proxy.ts` (`strict-dynamic`). ℹ️ Las cookies de sesión de `@supabase/ssr` no son httpOnly por diseño de la librería |
| B8 | Baja | Revertir un descuento manual no emitía la recompensa | ✅ Se llama a `issue_rewards` |
| I1 | Info | Owner/admin pueden leer contacto completo por PostgREST | ℹ️ Por diseño: administración puede ver datos de clientes; la UI los muestra enmascarados |
| I2 | Info | Campañas legibles entre empresas | ✅ Solo personal o clientes de esa empresa |
| I3 | Info | Un gerente leía todas las tarjetas | ✅ Solo dueño de la tarjeta y administración |
| I4 | Info | `staff_lookup_card` obsoleta y sin validar apartados | ✅ Revocada |
| I5 | Info | Riesgo de funciones ejecutables por accidente | ✅ Prueba de inventario: `anon` no ejecuta nada y `authenticated` solo una lista permitida |
| I6 | Info | "Append-only incluido superusuario" exagerado | ✅ Corregido: un superusuario puede desactivar triggers; la protección es contra roles de la app |
| I7–I9 | Info | Reverso en cascada (FIFO), límites internos de admin, abuso de ajustes | ℹ️ Aceptados y auditados; pendiente agregar alertas en el panel |

Pruebas de regresión: `tests/db/audit-fixes.test.ts`.

### Segunda revisión de los parches

El auditor volvió a revisar los commits de corrección:

- **Cerrados:** M2, B1, B2, B3, B4, B6, B7, B8, I3 e I4.
- **Parciales:**
  - **M1:** un barista todavía podría sumarse sellos con una segunda cuenta de cliente. Mitigación pendiente: cruzar con el POS y alertar por barista.
  - **M3:** el CAPTCHA falta activarlo en Supabase.
  - **M4:** la MFA es opcional. Riesgo: con una contraseña robada de una cuenta sin factor, alguien podría inscribir su propio factor.
  - **B5:** el panel incluye DEMO por defecto.
  - **I2:** los clientes ven `change_reason` de la campaña.
- **Nuevos hallazgos, corregidos:**
  - **N1 (media):** el proxy no reenviaba a la página las cookies de sesión renovadas. Ahora se copian a los encabezados de la petición.
  - **N2:** owner/admin con MFA y sesión aal1 no podían operar la barra. Ahora la barra no exige aal2 y la administración sí.
  - **N3:** los fallos de envío del código al personal se registran en la auditoría, sin el correo.
  - **N4:** el límite por dispositivo usa solo la cabecera de confianza del hosting (`TRUSTED_IP_HEADER`).
  - **B2:** los bloqueos se toman en orden de `id` para evitar interbloqueos.

## Controles vigentes

| Amenaza | Control | Verificación |
|---|---|---|
| Acceso anónimo | `anon` no ejecuta ninguna función; solo lee nombre de negocio y sucursales | `security.test.ts`, `audit-fixes.test.ts` (inventario) |
| IDOR/BOLA | Cada RPC deriva la empresa del objeto y valida rol y sucursal; lo ajeno responde `not_found` | `security.test.ts`, `admin.test.ts` |
| Repetición de QR | Token de 256 bits, solo hash en BD, TTL ≤ 5 min, un uso; el apartado queda ligado a barista y sucursal | `loyalty.test.ts`, `bar-flow.test.ts` |
| NFC clonado | El id NFC solo indica sucursal; no autoriza nada | `loyalty.test.ts` |
| Doble acreditación o canje | Idempotencia, folio único por sucursal (HMAC), `FOR UPDATE`, CHECK ≥ 0 | `loyalty.test.ts` |
| Fraude interno | Sin auto-acreditación; acreditar sin QR exige gerente; reversos y ajustes con motivo y actor | `audit-fixes.test.ts` |
| Robo de credenciales de administración | MFA TOTP con `aal2` para administrar | `audit-fixes.test.ts` |
| Abuso de envíos | Límites en la BD + Supabase; CAPTCHA Turnstile (activar) | `staff-login.test.ts` |
| XSS | CSP con nonce y `strict-dynamic`; sin HTML de usuarios; el QR es SVG generado en el servidor | `landing.spec.ts` (sin violaciones de CSP) |
| Clickjacking y sniffing | `frame-ancestors 'none'`, `nosniff`, HSTS | `landing.spec.ts` |
| Alteración del historial | Triggers append-only (ledger, auditoría, versiones de campaña) para los roles de la app | `security.test.ts` |
| Fuga de PII | El barista ve contacto enmascarado; la auditoría no guarda tokens ni búsquedas; Google no recibe contacto | `security.test.ts`, `wallet.test.ts` |
| Datos temporales | `private.cleanup_ephemeral()` cada hora con pg_cron | `audit-fixes.test.ts` |

## Pendientes antes de producción
- Activar CAPTCHA en Supabase y definir `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- Hacer obligatoria la MFA para owner/admin (hoy es opcional y se recomienda en Cuenta).
- Pruebas de concurrencia con varias conexiones contra Supabase. PGlite usa una sola, así que las carreras de bloqueo no se pudieron reproducir.
- Alertas: barista con proporción alta de sellos, ajustes grandes, reversos de canje.
- Cruce de ventas con tarjeta contra el POS importado, por folio y día.
- Confirmar en el proyecto en la nube la política de contraseñas, la confirmación de correo y los límites de Auth.
