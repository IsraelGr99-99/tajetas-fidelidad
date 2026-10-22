# Café Nómada · Fidelidad

Sistema de fidelidad digital de [iautomexa](https://iautomexa.com) para el piloto de Café Nómada en San Pedro Cholula, Puebla. Arquitectura multiempresa; destino de demo: `https://fidelidad-demo.iautomexa.com` (aún **no publicado**).

## Estado

- ✅ **Etapa 1**: Next.js 16 + TypeScript estricto, sistema visual de marca, landing accesible y headers de seguridad.
- ✅ **Etapa 2** (aplicada en Supabase): esquema multiempresa, ledger append-only, campañas versionadas, RLS y funciones transaccionales para acreditar, canjear, revertir y ajustar.
- ✅ **Etapa 3**: acceso del personal en `/personal` (login, logout, roles y sucursal).
- ⏳ Siguiente: registro de clientes con verificación y QR (etapa 4). Ver [docs/hoja-de-ruta.md](docs/hoja-de-ruta.md).

Todavía no funcionan el registro de clientes, las visitas ni Wallet; la UI lo indica con claridad.

## Ejecutar localmente

```bash
npm install
cp .env.example .env.local   # en Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

## Verificación

```bash
npm run check      # typecheck + lint + pruebas unitarias y de base de datos
npm run build
npx playwright install chromium   # solo la primera vez
npm run test:e2e
```

Las pruebas de base de datos aplican las migraciones reales en PostgreSQL (PGlite, en memoria) con un stub de Supabase Auth; no requieren Docker ni credenciales.

## Documentación

- [Arquitectura y contratos](docs/arquitectura.md)
- [Decisiones](docs/decisiones.md)
- [Seguridad](docs/seguridad.md) · [Privacidad](docs/privacidad.md)
- [Sello NFC](docs/nfc-sello.md)
- [Configuración externa: Supabase, Wallet, dominio](docs/implementacion.md)
- [Hoja de ruta](docs/hoja-de-ruta.md)
