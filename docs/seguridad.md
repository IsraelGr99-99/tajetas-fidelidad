# Seguridad: modelo de amenazas y controles

Estado: controles de base de datos implementados y probados en PGlite (`tests/db`). **Pendiente**: auditoría independiente, pruebas contra Supabase real, CSP con nonce y revisión del despliegue. Nada de esto se considera “seguro para producción” hasta completar la etapa 8.

## Activos
Saldos y recompensas, datos de contacto de clientes, credenciales del personal, llaves de Supabase/Wallet, integridad del historial.

## Amenazas y controles

| Amenaza | Control | Verificación |
|---|---|---|
| Acceso anónimo a datos | `revoke all` a `anon`; solo `businesses`/`branches` públicos; RPC solo para `authenticated` | `security.test.ts` |
| IDOR/BOLA entre empresas o clientes | Cada RPC valida rol + objeto; eventos de otra empresa responden `not_found`; RLS por fila | `security.test.ts` |
| Barista acredita a conocidos sin el cliente | Acreditar sin QR exige gerente+ y queda marcado `staff_lookup` | `loyalty.test.ts` |
| Repetición de QR | Token aleatorio, hash en BD, caducidad ≤10 min, consumo atómico de un uso | `loyalty.test.ts` |
| Clonado/repetición de NFC | El id NFC es público y solo indica sucursal; no autoriza nada | `loyalty.test.ts` |
| Doble acreditación | Idempotency key única por empresa, ticket único (HMAC), 1 sello por compra, espera mínima, máximo diario | `loyalty.test.ts` |
| Doble canje / saldo negativo | `FOR UPDATE` en tarjeta, CHECK `>= 0`, token de canje de un uso | `loyalty.test.ts` (secuencial) |
| Manipulación de precio/elegibilidad | Precios y elegibilidad salen del catálogo; el navegador solo envía ids y cantidades | `loyalty.test.ts` |
| Alteración del historial | Triggers append-only (incluido superusuario y TRUNCATE) | `security.test.ts` |
| Fuerza bruta / abuso | Rate limits: alta 10/h, QR 30/10 min, lookup 120/10 min, acreditación 60/10 min, canje y ajustes 30/10 min | `security.test.ts`, `loyalty.test.ts` |
| Fuga de PII al personal | Barista no lee `customers`; lookup devuelve contacto enmascarado | `security.test.ts` |
| Secretos en repositorio/logs | `.env*` ignorados; auditoría sin tokens; `server-only` en `src/lib/env.ts` | revisión |
| Clickjacking / sniffing | `frame-ancestors 'none'`, `nosniff`, HSTS, `Referrer-Policy` | `landing.spec.ts` |

## Pendientes conocidos
- Probar concurrencia real (varias conexiones) contra Supabase: PGlite usa una sola conexión.
- CSP completa con nonce (`proxy.ts`) y CSRF en Server Actions (Next valida `Origin`; revisar con dominio final).
- Limpieza periódica de `scan_tokens` vencidos y `private.rate_limit_hits` (pg_cron).
- MFA para owner/admin (Supabase Auth TOTP).
- Rate limit por IP en endpoints públicos (registro/OTP) en la capa de app, además del de Supabase Auth.
- Revisión de los `security definer` por un auditor independiente.
