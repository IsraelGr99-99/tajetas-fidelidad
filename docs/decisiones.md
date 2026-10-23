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
Correo: Supabase Auth con OTP numérico y SMTP propio de capa gratuita (Resend o Brevo). El SMTP integrado de Supabase no sirve para clientes reales (solo envía a miembros del equipo y con límite muy bajo). Teléfono: no existe SMS gratuito real; para el demo se usan números de prueba (`auth.sms.test_otp`) o el crédito de prueba de Twilio (solo números verificados). En la UI el canal teléfono se muestra como “no disponible” mientras no haya proveedor configurado.

## 2026-10-25 · ADR-015 Rediseño de navegación y flujo de barra
- Rutas cortas: `/barra`, `/movimientos`, `/negocio/*`, `/cuenta`, `/entrar`. Las rutas `/personal/*` redirigen de forma temporal (307) a las nuevas.
- Menú fijo según el rol: lateral en computadora, inferior en celular. La sucursal se cambia desde el encabezado.
- `/barra` es una sola pantalla y el QR decide el flujo (visita o canje). Al escanear, `staff_claim_card` consume el QR del cliente y **aparta** la tarjeta 5 min para ese barista y sucursal: un código interno de un uso, que no sirve a otro barista ni en otra sucursal. Así se escanea primero sin que el QR de 2 min caduque mientras se captura el ticket.
- Productos más vendidos como botones (`staff_catalog`, últimos 30 días). La confirmación queda fija en pantalla antes de sumar.
- Cliente: el QR aparece solo; `my_card_status` se consulta cada 3 s mientras la pantalla está visible para mostrar “Código escaneado” y “¡Sello registrado!” sin recargar.
- Seguridad (ADR-011 corregido): el código por correo del personal ya no se envía a cualquiera. `request_staff_login_code` (solo `service_role`) verifica que el correo sea de personal activo o esté invitado, limita intentos por correo y dispositivo y responde igual en ambos casos. Limitación: la API pública de Supabase Auth sigue permitiendo altas (las necesita el registro de clientes); esas cuentas no obtienen acceso a la consola. Para endurecerlo, agregar CAPTCHA (Turnstile) en la etapa 8.

## 2026-10-26 · ADR-016 Finanzas, importaciones y datos DEMO
- Dos fuentes separadas y rotuladas: **ventas POS** (reporte importado por sucursal) y **ventas con tarjeta** (compras registradas en barra). El panel no las suma: muestra el total POS y qué porcentaje pasó por la tarjeta.
- Ganancia bruta = ventas POS − costo de lo vendido (`products.cost_cents`, empatado por nombre). El panel muestra qué parte de las ventas tiene costo conocido. Utilidad neta = ganancia bruta − gastos.
- El costo es interno: se revocó la lectura de `products.cost_cents` para el rol `authenticated` (privilegio por columna) y solo administración lo lee vía `admin_catalog`.
- Importación de Excel/CSV en el navegador con `read-excel-file` (nueva dependencia; solo lee `.xlsx`, sin macros ni fórmulas) y un lector CSV propio. Solo viajan los renglones interpretados; el servidor revalida con zod y la base todo o nada. El catálogo se actualiza por nombre; un reporte idéntico (sucursal, periodo, renglones y total) se rechaza como duplicado.
- Datos DEMO: `generate_demo_finance` crea 60 días de ventas y gastos con el catálogo real y una sucursal ficticia inactiva “Angelópolis (DEMO)”, todo con `is_demo`. El panel los rotula y permite ocultarlos; `clear_demo_finance` los borra sin tocar datos reales.
- Gráficas sin librería: una serie por gráfica, sin doble eje, valores en tinta de texto, tooltip con cursor o teclado y tabla alternativa.

## 2026-10-24 · ADR-014 Gerencia y administración
- Alta de personal por **invitación**: owner/admin registra correo, nombre, rol y sucursales. La persona entra con “código por correo”, y `claim_staff_invitations` crea su membresía solo si el correo está verificado. No se comparten contraseñas ni se usa la llave secreta para dar de alta.
- Jerarquía: owner gestiona todo; admin solo gerentes y baristas; nadie cambia su propio rol o estado; siempre queda al menos un owner activo; no se puede desactivar la última sucursal activa.
- Bitácora (`list_ledger`): el gerente ve solo su sucursal; admin ve todas. El contacto del cliente sale enmascarado y se muestra el actor de cada movimiento.
- Clientes: no hay listado general. La búsqueda es exacta por correo, teléfono o serial; va por POST (no queda en la URL) y se audita el tipo de búsqueda, nunca el dato.
- Baja de cuenta: `delete_my_customer_data` anonimiza al cliente y borra sus QR; después la app borra el usuario de Auth con la llave secreta (`src/lib/supabase/admin.ts`, único uso), excepto si esa cuenta también es de personal.
- El resumen de administración se calcula en vivo desde la bitácora; no hay métricas inventadas.

## 2026-10-23 · ADR-013 Operación en barra (visita y canje)
- Orden del flujo de visita: ticket (folio + productos) → QR del cliente → confirmación. El QR se escanea al final para que sus 120 s no se agoten mientras se captura.
- El folio es obligatorio (los tickets de Café Nómada lo traen impreso). Se convierte en HMAC en el servidor con `PURCHASE_REFERENCE_PEPPER`; la base nunca ve el folio en claro. **El pepper no debe cambiar una vez en producción**: si cambia, un ticket ya usado tendría otro hash y podría volver a sumar.
- La llave de idempotencia se crea al llegar a “Confirmar” y se reutiliza en cada reintento: un corte de red no duplica sellos ni canjes.
- Lector QR: `BarcodeDetector` nativo cuando existe; si no, `jsqr` (nueva dependencia, sin dependencias propias, se carga solo en ese caso). También acepta lectores USB tipo teclado. Lo leído se trata como entrada no confiable.
- El canje solo acepta QR con propósito `redeem`, que el cliente genera tras confirmar en su teléfono.
- Pruebas e2e: `tests/e2e/global-setup.ts` calienta Chromium. En Windows, sus primeras navegaciones tardaban más de 15 s aunque el servidor respondía en milisegundos.

## 2026-10-23 · ADR-012 Registro de clientes y QR
- Acceso del cliente sin contraseña: OTP de 8 dígitos (la UI acepta de 6 a 10 para no depender del ajuste del proyecto) (correo vía Resend; teléfono cuando haya SMS, controlado por `NEXT_PUBLIC_PHONE_AUTH_ENABLED`). Mismo flujo para crear la tarjeta y para volver a entrar. Corre en el navegador por la misma razón que el login del personal (ADR-011).
- `enroll_customer` exige la versión del aviso de privacidad (`PRIVACY_VERSION`) y guarda fecha de aceptación. El contacto lo lee la base desde `auth.users` ya verificado; el navegador nunca lo envía.
- QR: `CN1.<32 bytes base64url>` generado en el servidor; la base guarda solo SHA-256, TTL 120 s, un uso. No requiere secreto de firma porque la validación es contra la base (se retiró `SCAN_TOKEN_SECRET`). Se renueva solo mientras la pantalla está visible y hasta 4 veces seguidas, para no agotar el límite de 30 códigos cada 10 min.
- Nueva dependencia `qrcode`: genera el SVG del QR en el servidor (sin JS extra en el navegador). Implementar un codificador QR propio no se justifica.
- Folios de ticket: `hashPurchaseReference` (HMAC-SHA256 con pepper, separado por empresa), listo para la etapa 5.

## 2026-10-23 · ADR-011 Sesión del personal
- `@supabase/ssr` + `@supabase/supabase-js`: librerías oficiales para guardar la sesión en cookies y leerla en Server Components, Server Actions y `proxy.ts`.
- El login (`signInWithPassword`) ocurre en el navegador: así los límites por IP de Supabase Auth aplican a cada dispositivo. Si fuera en el servidor, todos los intentos saldrían de la misma IP.
- El servidor confía solo en `getClaims()` (JWT verificado), nunca en `getSession()`.
- `proxy.ts` refresca la sesión y redirige a login a quien no tiene sesión en `/personal/*`. Es una primera barrera: cada página y Server Action vuelve a verificar, y la base valida otra vez.
- La sucursal elegida vive en la cookie `cn_sucursal` (httpOnly, `path=/personal`, 12 h). No es credencial: se valida contra `get_staff_context()` en cada petición.
- `?siguiente=` solo acepta rutas internas de `/personal` (anti open-redirect).
- Piloto: una empresa por persona en la UI (el backend ya soporta varias).

## 2026-10-22 · ADR-010 Identidad visual
Fraunces (serif de remates suaves, eje SOFT) para títulos, Figtree para texto y Courier Prime con moderación para etiquetas tipo bitácora. Las fuentes se sirven desde el propio dominio vía `next/font`. Paleta de marca con variante `arcilla-texto` (#8A4935) para cumplir contraste AA. El logotipo es un placeholder vectorial reemplazable (`src/components/brand/Logo.tsx`, `public/brand/logo.svg`).
