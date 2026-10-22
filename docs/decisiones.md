# Registro de decisiones (ADR breve)

## 2026-10-22 · ADR-001 Stack
Next.js 16.4 (App Router) + React 19 + TypeScript estricto + Tailwind CSS 4, Supabase (PostgreSQL, Auth, Storage). Se actualizó de Next 15.5 a 16 porque el proyecto aún no tenía código significativo y 16 es la versión con soporte vigente.

## 2026-10-22 · ADR-002 Reglas de fidelidad en PostgreSQL
Acreditar y canjear requiere atomicidad (bloqueo de tarjeta + ledger + saldo + auditoría). `supabase-js` no ofrece transacciones, así que las reglas viven en funciones `security definer` con `search_path = ''`. El TypeScript solo valida forma de entrada, calcula hashes y presenta resultados. Alternativa descartada: lógica en Node con la llave secreta (más superficie de ataque, sin RLS como defensa en profundidad).

## 2026-10-22 · ADR-003 Ledger con tipo `reward_issued`
Además de `earn`, `redeem`, `reverse` y `manual_adjustment`, se agregó `reward_issued` (origen `system`): convierte N sellos en 1 recompensa y congela su **tope de valor** en ese momento. Así el saldo de sellos y el de recompensas son sumas simples del ledger y el tope queda auditado.

## 2026-10-22 · ADR-004 Doble canje
Se evita con bloqueo `FOR UPDATE` de la tarjeta, `rewards_balance >= 0` (CHECK) e idempotencia. No hay índice único “un canje por recompensa” porque un canje revertido debe permitir canjear de nuevo esa recompensa (detectado por prueba).

## 2026-10-22 · ADR-005 Códigos QR
El QR contiene solo un token aleatorio; la base guarda su SHA-256 con propósito (`identify`/`redeem`), caducidad ≤10 min y consumo atómico de un solo uso. El canje exige un QR `redeem` generado por el cliente: esa es su confirmación.

## 2026-10-22 · ADR-006 Rate limiting en base de datos
Ventana fija en `private.rate_limit_hits`, sin Redis ni servicios externos. Suficiente para el piloto; revisar si crece el tráfico (limpieza periódica de ventanas viejas pendiente).

## 2026-10-22 · ADR-007 Tope de recompensa
`min_eligible_item_in_completing_ticket`: precio de la bebida elegible más barata del ticket que completó el ciclo (con tope máximo opcional). Si el ciclo lo completa un ajuste manual (sin ticket), se usa la bebida elegible activa más económica del catálogo. Alternativa configurable: `fixed`.

## 2026-10-22 · ADR-008 Dependencias de desarrollo
- `vitest`: pruebas unitarias y de integración.
- `@electric-sql/pglite`: PostgreSQL real en WASM para probar migraciones, RLS y RPC sin Docker ni credenciales. Limitación: una sola conexión, así que no prueba carreras reales entre conexiones; eso se verificará contra Supabase en la etapa 8.
- `@playwright/test`: e2e en móvil y escritorio.
- `zod`: validación tipada en servidor (dependencia de producción).
- `npm audit` reporta `braces` (alta) solo dentro de la cadena de `eslint-config-next`; es herramienta de desarrollo y no se distribuye. Revisar al actualizar.

## 2026-10-22 · ADR-009 Verificación de contacto gratuita para el demo
Correo: Supabase Auth con OTP de 6 dígitos y SMTP propio de capa gratuita (Resend o Brevo). El SMTP integrado de Supabase no sirve para clientes reales (solo envía a miembros del equipo y con límite muy bajo). Teléfono: no existe SMS gratuito real; para el demo se usan números de prueba (`auth.sms.test_otp`) o el crédito de prueba de Twilio (solo números verificados). En la UI el canal teléfono se muestra como “no disponible” mientras no haya proveedor configurado.

## 2026-10-22 · ADR-010 Identidad visual
Fraunces (serif de remates suaves, eje SOFT) para títulos, Figtree para texto y Courier Prime con moderación para etiquetas tipo bitácora. Las fuentes se sirven desde el propio dominio vía `next/font`. Paleta de marca con variante `arcilla-texto` (#8A4935) para cumplir contraste AA. El logotipo es un placeholder vectorial reemplazable (`src/components/brand/Logo.tsx`, `public/brand/logo.svg`).
