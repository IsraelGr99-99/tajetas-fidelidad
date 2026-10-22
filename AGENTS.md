# Instrucciones para agentes y colaboradores

Sistema de fidelidad digital de **iautomexa**. El primer piloto es **Café Nómada** (San Pedro Cholula, Puebla), aunque la arquitectura es multiempresa.

## Reglas del proyecto

- La base de datos es la **única fuente de verdad**. Saldos, valor y elegibilidad los decide PostgreSQL (`supabase/migrations`), nunca el navegador.
- Toda escritura de fidelidad pasa por las funciones RPC `security definer`. No agregues políticas RLS de `insert/update/delete` sobre tablas de negocio.
- El ledger (`ledger_events`), `audit_log`, `campaign_versions` y `purchase_items` son **append-only**. Para cambiar algo, crea un evento nuevo (reverso o ajuste con motivo).
- Toda migración nueva se crea con timestamp (`supabase migration new <nombre>`) y nunca se edita una migración ya aplicada en un entorno compartido.
- Toda tabla nueva: `enable row level security`, revisar `grant`s y agregar pruebas en `tests/db/security.test.ts`.
- No guardes secretos, tokens completos ni PII completa en logs, auditoría, fixtures ni capturas.
- UI en español de México, `America/Mexico_City`, montos en centavos MXN (`src/lib/format.ts`).
- Las integraciones sin credenciales muestran estados honestos de “no configurado”. Nunca simules que algo funcionó.
- No agregues dependencias sin justificarlo en `docs/decisiones.md`.

## Comandos

```bash
npm run check      # tsc + eslint + vitest (unitarias + base de datos en PGlite)
npm run build
npm run test:e2e   # Playwright contra el build de producción
```

## Mapa

- `src/app` — rutas (App Router). `src/components` — UI. `src/domain` — reglas puras y esquemas. `src/lib` — utilidades de servidor.
- `supabase/migrations` — esquema, RLS y RPC. `supabase/seed.sql` — datos iniciales sin PII.
- `tests/db` — pruebas de base de datos (PGlite + stub de Supabase Auth). `tests/e2e` — Playwright.
- `docs/` — arquitectura, decisiones, seguridad, privacidad, NFC, configuración externa y hoja de ruta.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
