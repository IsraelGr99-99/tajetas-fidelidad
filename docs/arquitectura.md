# Arquitectura y contratos

## Vista general

```
Navegador (cliente / personal)
   │  HTTPS, cookies de sesión de Supabase Auth
   ▼
Next.js 16 (App Router) — Server Components, Server Actions, Route Handlers
   │  • valida entrada con zod
   │  • calcula HMAC del folio de ticket y hash de códigos QR
   │  • llama RPC con el JWT del usuario (llave publicable + sesión)
   ▼
Supabase PostgreSQL — RLS + funciones `security definer`
   • autorización por rol y por objeto (empresa/sucursal/tarjeta)
   • reglas de fidelidad, idempotencia, rate limit, auditoría
   • ledger append-only + proyección de saldos bloqueada por fila
```

Decisión clave: las reglas viven en PostgreSQL porque acreditar/canjear exige **atomicidad** (bloqueo de la tarjeta, inserción en el ledger, actualización de saldo y auditoría en una sola transacción). El JS del servidor no decide saldos; solo prepara entradas y traduce resultados a UI.

## Modelo de datos

| Tabla | Propósito | Mutabilidad |
|---|---|---|
| `businesses`, `branches` | Empresa y sucursales (multiempresa) | editable por admin |
| `staff_members`, `staff_branch_access` | Personal con rol (`owner`, `admin`, `manager`, `barista`) y sucursales asignadas | editable por admin |
| `customers` | Un solo canal verificado (correo **o** teléfono) | anonimizable |
| `loyalty_cards` | Proyección de saldos (`stamps_balance`, `rewards_balance`) y `public_serial` | solo vía RPC |
| `campaigns`, `campaign_versions` | Regla vigente = versión más alta con `effective_from <= now()` | versiones inmutables |
| `products` | Catálogo con precio y elegibilidad | editable por admin |
| `purchases`, `purchase_items` | Ticket pseudonimizado (HMAC del folio) y partidas con precio congelado | estado de compra cambia solo por reverso |
| `ledger_events` | `earn`, `reward_issued`, `redeem`, `reverse`, `manual_adjustment` | **append-only** |
| `scan_tokens` | Hash de códigos QR temporales (≤10 min, un uso) | consumo atómico |
| `nfc_devices` | Identificador público del sello físico → sucursal | editable por admin |
| `audit_log` | Accesos, rechazos y cambios administrativos | **append-only** |

Saldos: `stamps_balance = Σ stamps_delta` y `rewards_balance = Σ rewards_delta`. `private.verify_card_projection(card_id)` comprueba que la proyección coincide con el ledger.

## Contratos RPC (PostgreSQL → servidor de la app)

Todas devuelven `jsonb`: `{ "ok": true, ... }` o `{ "ok": false, "code": "<código>" }`. Solo el rol `authenticated` puede ejecutarlas.

| Función | Quién | Entrada | Éxito |
|---|---|---|---|
| `enroll_customer(slug, display_name?)` | cliente con canal verificado en Auth | — | `card_id`, saldos |
| `get_my_card(slug)` | cliente | — | tarjeta, campaña, contacto enmascarado, historial (sin actores ni hashes) |
| `issue_scan_token(card_id, purpose, token_hash, ttl)` | dueño de la tarjeta | `purpose`: `identify`/`redeem`, TTL 30–300 s | `expires_at` |
| `staff_lookup_card(branch_id, token_hash)` | personal de la sucursal | — | datos mínimos y enmascarados; no consume el código |
| `record_earn(branch_id, idem_key, purchase_ref_hash, items, token_hash?, card_id?, nfc_public_id?)` | personal (con QR) o gerente+ (sin QR) | `items`: `[{product_id, quantity, complimentary?}]` | `event_id`, `stamps_added`, `rewards_issued`, saldos |
| `redeem_reward(branch_id, idem_key, redeem_token_hash)` | personal; requiere QR de canje del cliente | — | `reward_value_cap_cents`, saldos |
| `reverse_ledger_event(event_id, reason, idem_key, purchase_status)` | gerente (su sucursal), admin, owner | motivo 5–300 car. | `event_id` del reverso |
| `adjust_stamps(card_id, delta, reason, idem_key)` | admin, owner | delta ±1..50 | `event_id`, recompensas emitidas |
| `publish_campaign_version(campaign_id, rules, reason)` | admin, owner | `rules` = `CampaignRules` (`src/domain/loyalty/campaign.ts`) | `version` |

### Códigos de rechazo

`not_authenticated`, `forbidden`, `not_found`, `invalid_request`, `invalid_items`, `idempotency_conflict`, `rate_limited`, `token_invalid`, `nfc_invalid`, `card_not_found`, `card_inactive`, `no_active_campaign`, `duplicate_purchase`, `not_eligible`, `too_soon` (+`retry_after_seconds`), `daily_limit`, `no_reward_available`, `not_reversible`, `already_reversed`, `requires_manual_review`, `would_go_negative`, `invalid_rules`, `contact_not_verified`, `contact_already_enrolled`, `business_not_found`, `not_enrolled`.

La UI traduce cada código a un mensaje claro en español (etapa 5).

## Flujos

**Acreditar visita**
1. Cliente abre su tarjeta → el servidor genera un token aleatorio, guarda su hash con `issue_scan_token` y muestra el QR (solo contiene el token; sin PII ni puntos).
2. Barista (sesión iniciada, sucursal asignada) escanea → `staff_lookup_card` muestra nombre corto, contacto enmascarado y progreso.
3. Barista captura el folio del ticket y las partidas del catálogo → pantalla de confirmación → `record_earn` con una llave de idempotencia generada al abrir la confirmación (los reintentos reutilizan la misma llave).
4. PostgreSQL consume el código, bloquea la tarjeta, valida compra/elegibilidad/frecuencia, escribe ledger, emite recompensa si completa el ciclo y audita.

**Canjear**: el cliente pulsa “Canjear” en su teléfono (confirmación del cliente) → QR con propósito `redeem` → el barista lo escanea → `redeem_reward` (atómico, una recompensa por código).

**NFC**: el sello abre `https://…/s/<public_id>`; la app usa ese id solo para preseleccionar la sucursal y lo envía como `nfc_public_id`. Sin empleado autenticado, QR válido y compra válida no hay sello. Ver `docs/nfc-sello.md`.
