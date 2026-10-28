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

## 2026-10-28 · ADR-018 Endurecimiento tras la auditoría
- CSP con nonce por petición en `proxy.ts` y render dinámico de todas las páginas (`connection()` en el layout). Para estilos se permite `unsafe-inline` porque React usa atributos `style`.
- MFA TOTP de Supabase. Se exige `aal2` para administrar solo si el usuario ya tiene un factor verificado, así nadie queda bloqueado al activarla. Volverla obligatoria es un pendiente explícito.
- CAPTCHA con Cloudflare Turnstile (gratuito), activado solo si existe la llave pública. Supabase valida el token en el servidor.
- Código del personal: el servidor solo verifica que el correo esté autorizado (`checkStaffCodeAction`) y el **navegador** pide el código con su token de CAPTCHA. Reenviar el token desde el servidor hacía que Supabase lo rechazara (`captcha_failed`). Se acepta el riesgo bajo de enumeración (ver B3 en `docs/seguridad.md`).
- Retención: `private.cleanup_ephemeral()` programada con pg_cron. Si pg_cron no está disponible, la migración no falla y se avisa.
- El folio del ticket se identifica por sucursal (HMAC con empresa + sucursal + folio).

## 2026-10-27 · ADR-017 Google Wallet (Apple Wallet pospuesto a producción)
- Adaptador propio (`src/lib/wallet/google.ts`): token OAuth con la cuenta de servicio firmado con `node:crypto` (RS256), API REST de Wallet Objects y enlace "Agregar a Google Wallet" firmado. No se agregó la librería de Google.
- Una `LoyaltyClass` por negocio (`<issuer>.<slug>-fidelidad`) y un `LoyaltyObject` por tarjeta (`<issuer>.tarjeta-<public_serial>`). Datos enviados a Google: número corto de tarjeta, nombre opcional, sellos y recompensas. Nunca correo ni teléfono.
- **Sin código escaneable en el pase**: un código fijo permitiría repetirlo. El pase enlaza a `/tarjeta`, donde vive el QR de un solo uso. Mejora futura: `rotatingBarcode` con TOTP validado en el servidor.
- Sincronización: después de cada sello, canje, reverso o ajuste (`after()`, sin hacer esperar a la barra). Si falla, queda el error en `wallet_passes` y se reintenta al abrir `/tarjeta` o con `syncStalePasses`.
- La UI no afirma que el pase se guardó; Google lo confirma en su pantalla. En modo `demo` solo funciona con cuentas de prueba del emisor.
- Logotipo público en Supabase Storage (bucket `marca`, solo imágenes de marca).
- Apple Wallet: queda como "próximamente" hasta tener una cuenta de Apple Developer para producción.

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
- Clientes: owner/admin ven un padrón paginado de tarjetas activas de su negocio (nombre o referencia de tarjeta, alta y saldos), sin correo ni teléfono en el listado. La base aplica RLS a clientes y tarjetas. Para consultar contacto enmascarado y ajustar sellos, la búsqueda sigue siendo exacta por correo, teléfono o serial; va por POST (no queda en la URL) y se audita el tipo de búsqueda, nunca el dato.
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

## 2026-10-23 · ADR-019 Portada de iautomexa Loyalty
- `/` deja de ser la página de clientes de Café Nómada y pasa a vender el producto (iautomexa Loyalty) a otros negocios. La página del piloto se mueve a `/c/cafe-nomada`. Los enlaces de regreso de `/tarjeta`, `/privacidad` y `/entrar` apuntan ahí.
- Identidad de la portada tomada de iautomexa.com: Plus Jakarta Sans (vía `next/font`, sin dependencia nueva), noche `#04070f`, eléctrico `#2e5cff` y cian `#22d3ee`, con contraste AA documentado en `globals.css`. Los estilos viven bajo `.lx`. Las pantallas del cliente y del personal conservan la identidad de Café Nómada (ADR-010).
- La portada solo anuncia funciones que existen. Apple Wallet, puntos, niveles, cupones y avisos van como “Próximamente”. El teléfono y el panel son ilustraciones rotuladas como ejemplo o DEMO. No hay cifras ni testimonios inventados.

## 2026-10-25 · ADR-020 Landing bilingüe y superficie clara
- La portada de Loyalty usa una superficie clara con color azul, cian, coral y amarillo para hacer más evidente la propuesta de valor y separar la marca de la experiencia Café Nómada.
- Español (`/`) e inglés (`/en`) comparten el componente `LoyaltyLanding`; solo cambia el diccionario de contenido. Cada ruta declara `canonical` y `hreflang` alternos.
- La primera capa de interacción usa `IntersectionObserver`, CSS, SVG y `prefers-reduced-motion`. GSAP/ScrollTrigger no se añadió porque la instalación quedó bloqueada por el registro de npm y no se debe declarar una dependencia no verificada.
- Las métricas de la maqueta siguen rotuladas como DEMO; no representan datos de producción.

## 2026-10-25 · ADR-021 Caja e inventario inicial del piloto
- Inventario separado por sucursal: `stock_items`, `stock_balances`, `product_recipes` y `stock_movements`. Cada venta de caja ejecuta `record_pos_sale` en una sola transacción; precios y disponibilidad se leen de PostgreSQL y se descuenta la receta completa. RLS solo permite lectura administrativa; no hay políticas de escritura. Los movimientos, ventas y renglones son append-only. La migración ya se aplicó al Supabase de pruebas; falta validar la operación autenticada y el hardware en sitio.
- Excel/CSV de inventario representa un conteo **absoluto**, no una suma. `import_stock_count` valida hasta 500 filas y registra como movimiento solo la diferencia; repetir el conteo sin cambios no duplica stock. El navegador muestra vista previa y el servidor vuelve a validar.
- La caja registra cobros confirmados manualmente (efectivo, terminal o transferencia externa). **No procesa pagos** ni integra devoluciones/cortes de caja. Las ventas de caja se reportan por separado de archivos POS importados y de compras de fidelidad para evitar dobles sumas. La acreditación de sellos sigue siendo un flujo independiente; falta conciliar el folio de caja con la visita.
- `buildEscPosTicket` crea bytes ESC/POS ASCII básicos para papel 58/80 mm. No hay transporte USB/red/Bluetooth, perfil de modelo, acentos/codepage ni prueba física. La UI muestra el estado pendiente y no afirma imprimir.
- La calculadora de catálogo estima precio desde costo de ingredientes, merma, mano de obra, empaque, indirectos, margen e impuesto configurable; no cambia precios ni sustituye asesoría fiscal. No se añadieron dependencias.

## 2026-10-26 · ADR-022 Variantes, operación y cumpleaños opcional
- Cada tamaño/medida se representa como producto vendible independiente: precio, costo y receta propios. `base_name` agrupa variantes sin crear una tabla adicional; el nombre visible conserva compatibilidad con caja y ventas. Categorías e insumos se comparan con clave de texto canónica (espacios y mayúsculas); las categorías se administran por RPC y no se duplican. El conteo Excel reutiliza insumos por esa clave.
- `operations_dashboard` agrega en PostgreSQL ventas de caja de la semana por sucursal, insumos al mínimo, productos sin receta y eventos recientes; la interfaz no calcula cifras comerciales desde datos parciales. Las listas de catálogo, recetas e inventario se filtran/paginan en la interfaz. Para catálogos grandes hará falta paginación del servidor.
- La búsqueda administrativa permite nombre parcial, correo exacto, teléfono y prefijo de serial; se audita solo el tipo de consulta, no el término. El listado general continúa enmascarado.
- Cumpleaños guarda únicamente día y mes, con consentimiento promocional separado del necesario para crear la tarjeta. Rechazarlo no impide usar fidelidad; retirarlo elimina día/mes y marca de consentimiento. No se generan descuentos ni se envían mensajes todavía: faltan canal, reglas comerciales y revisión legal del aviso de privacidad. La versión de consentimiento se incrementó para el nuevo texto.
- Las migraciones se crean con timestamp posterior a la última aplicada; los respaldos de esquema y datos del entorno de pruebas se guardan fuera de Git en `.local-backups/`. El volcado de datos advierte sobre una referencia circular del ledger; la restauración completa requiere procedimiento probado antes de uso productivo. Sin dependencias nuevas.

## 2026-10-26 · ADR-023 Fotos del catálogo y disponibilidad explicable
- La foto es opcional, vive en un bucket público `product-photos` con límite de 2 MB y tipos JPEG/PNG/WebP. Solo owner/admin puede subir o retirar objetos en la ruta empresa/producto mediante RLS de Storage; la ruta activa se cambia por RPC con verificación de empresa. Se sirven miniaturas sin proxy de optimización; la CSP permite únicamente el origen Supabase configurado. No se usa una URL arbitraria ni se agregan dependencias.

## 2026-10-27 · ADR-024 Unidad corregible y cuenta suspendida por el cliente
- El cambio de unidad de un insumo es explícito: conversión compatible de cantidades y recetas o corrección de etiqueta sin recálculo. La RPC bloquea sucursales y recetas para serializar con caja y registra `stock_unit_changes` append-only. No se reescriben movimientos previos. `caja` es una unidad canónica adicional.
- Los movimientos nuevos tienen `unit_at_event`; los anteriores se interpretan mediante el primer cambio de unidad. La migración final está probada en PGlite y su aplicación en Supabase de pruebas se confirmó el 27 de octubre de 2026. El recorrido autenticado de un cambio real sigue pendiente de prueba manual.
- La desactivación la inicia el cliente, bloquea su tarjeta y conserva el saldo. Owner/admin ve el motivo libre, sin incluirlo en auditoría; se borra al reactivar o eliminar. Reactivar exige acceso verificado y nueva aceptación de privacidad. Eliminar anonimiza contacto, nombre y motivo libre y desvincula Auth; conserva solo la categoría del motivo y el ledger sin PII. Ningún empleado puede reactivar la tarjeta en nombre del cliente.
- La política de fotos usa `private.has_role` en Storage porque `private.is_admin` no está concedida al rol `authenticated`; no se amplían grants ni políticas sobre otros buckets. Aplicada en el Supabase de pruebas, pendiente prueba de subida con owner real.
- Una prueba de Storage con owner/AAL2 detectó que la subconsulta de la política resolvía `name` como `products.name`, no como la ruta de `storage.objects`. Una migración nueva corrige las tres políticas a `storage.foldername(storage.objects.name)`. La migración de diseño de tarjeta recibió la misma corrección para los logos. El alta de producto acepta foto opcional y distingue guardado parcial de producto/foto; no se elimina ni duplica el producto ante un fallo de Storage. El propietario informó que aplicó ambas migraciones al Supabase de pruebas el 27 de octubre de 2026; la subida real de logo y foto sigue pendiente de comprobación.
- `pos_catalog` devuelve la disponibilidad calculada en PostgreSQL y los nombres/cantidades de ingredientes faltantes. La interfaz nunca decide si una venta es válida; `record_pos_sale` vuelve a validarla atómicamente. Productos sin receta quedan claramente diferenciados.
- El límite global de Server Actions sube a 3 MB para aceptar fotos de 2 MB más el sobrecosto del formulario. El servidor verifica tamaño, MIME y firma de archivo; se rechazan SVG y otros formatos activos. Las fotos son contenido público y no deben contener PII.

## 2026-10-27 · ADR-025 Diseño de tarjeta y cobro presencial
- La identidad de tarjeta se guarda una vez por empresa; las tarjetas existentes la leen en cada visita sin cambiar saldos ni historial. Colores y ruta de logo se actualizan solo por RPC owner/admin con MFA. El logo se almacena en bucket público separado, limitado a 2 MB y JPG/PNG/WebP, con permisos de Storage por empresa. El formulario valida contraste mínimo de texto de 4.5:1. No se añadieron dependencias.
- El pago con tarjeta registrado manualmente en caja sigue significando cobro realizado en una terminal externa; no implica captura ni confirmación automática. Stripe Terminal se solicitó para el piloto de Puebla, pero México no figura en sus países compatibles. No se añadirá un flujo que aparente cobrar con ese proveedor. La integración presencial queda supeditada a elegir un proveedor compatible, sus credenciales, terminal y webhooks; una venta nunca se debe confirmar desde un retorno de navegador sin verificación del proveedor.

## 2026-10-27 · ADR-026 Landing pública, demostración y animación por giro
- `integration` se adelantó por fast-forward desde `feat/ui-landing` y el rediseño vive en `feat/loyalty-site-redesign`; `main` queda intacta hasta validar. La URL pública de marketing es `loyalty.iautomexa.com`.
- La portada y `/en` sobrescriben el `noindex` raíz con metadatos indexables, canonical absoluto, hreflang y sitemap limitado a esas dos páginas. La consola, la tarjeta del cliente y el piloto conservan `noindex`. JSON-LD describe a iautomexa, el software y la página sin inventar precios, testimonios ni resultados de uso; GEO se apoya en contenido claro y verificable, no en trucos de marcado.
- La demo pública es una simulación en memoria del navegador: no requiere cuenta, no escribe en Supabase y no registra cobros. Sus datos se rotulan como ficticios. El CTA comercial sigue llevando al contacto de iautomexa.
- Se añadió `gsap` con ScrollTrigger para la secuencia de tarjetas por giro solicitada. Su carga es diferida; el contenido está en HTML desde el servidor, y si falla JavaScript, en móvil o con movimiento reducido, las tarjetas permanecen navegables mediante desplazamiento horizontal. La animación se desmonta al salir del componente para evitar triggers duplicados.

## 2026-10-27 · ADR-027 Experiencia web premium de Loyalty
- La web comercial `/` y `/en` conserva azul Loyalty, tipografía Plus Jakarta Sans y marca iautomexa, pero usa una composición editorial con la tarjeta como exhibición horizontal en el flujo del documento. No se modifica el tema independiente del piloto Café Nómada ni la lógica de autenticación, caja o fidelidad.
- Se agregó `@gsap/react` para usar `useGSAP()` con scope y limpieza automática en islas cliente de movimiento y galería. El contenido comercial pasa a un Server Component y permanece visible en HTML sin JavaScript. GSAP es mejora progresiva; el movimiento reducido desactiva entradas y efectos de scroll. La galería mantiene desplazamiento horizontal sin animación en móvil y reduce la distancia del pin en escritorio.
- El acceso público del personal, 404 y error genérico usan la misma dirección de arte sin tocar autenticación. Se quitó de la portada comercial el enlace al borrador de privacidad de Café Nómada: no representa un aviso de privacidad B2B de iautomexa; debe prepararse el aviso comercial correspondiente antes de enlazarlo.

## 2026-10-30 · ADR-028 Primer corte multiempresa
- La selección del negocio del personal se guarda en `loyalty_business` y se contrasta en cada petición con `get_staff_context()`. Si hay varias membresías no se escoge silenciosamente la primera; al cambiar se borra la preferencia de sucursal. La sucursal sigue validándose contra la membresía activa. El nombre heredado `cn_sucursal` se conserva para no romper sesiones existentes.
- El propietario puede crear hasta tres negocios **DEMO** propios, con correo verificado y TOTP confirmado en sesión `aal2`. Una RPC transaccional crea empresa, sucursal, owner, campaña/versionado y producto ficticio; no hay políticas RLS de escritura directa. La operación está limitada por usuario y serializada para no saltar el máximo con solicitudes simultáneas. No equivale al alta pública ni a facturación SaaS.
- La tarjeta del cliente se resuelve por `/c/[slug]`; `/tarjeta` y `/tarjeta/acceso` siguen siendo alias del piloto. Las acciones reciben el slug validado y la base vuelve a comprobar la pertenencia. El borrado de una tarjeta no elimina el usuario de Auth cuando conserva tarjetas activas de otras empresas.
- Se cerró la lectura RLS de productos activos a otras empresas. Se agregaron pruebas de dos negocios para membresías, catálogo y dos tarjetas de una misma persona. Ninguna migración se aplica automáticamente al proyecto compartido.
- El alta pública de clientes para los nuevos negocios está cerrada por defecto porque solo existe un borrador de aviso de privacidad para Café Nómada. `ENABLE_MULTI_BUSINESS_ENROLLMENT=true` es una opción de prueba controlada, no un ajuste para producción; antes de activarla hacen falta avisos y consentimiento por negocio y revisión legal. No hay nuevas dependencias.
