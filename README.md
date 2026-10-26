# Café Nómada · Fidelidad

Sistema de fidelidad digital de [iautomexa](https://iautomexa.com) para el piloto de Café Nómada en San Pedro Cholula, Puebla. Arquitectura multiempresa; destino de demo: `https://fidelidad-demo.iautomexa.com` (aún **no publicado**).

## Estado

- ✅ **Etapa 1**: Next.js 16 + TypeScript estricto, sistema visual de marca, landing accesible y headers de seguridad.
- ✅ **Etapa 2** (aplicada en Supabase): esquema multiempresa, ledger append-only, campañas versionadas, RLS y funciones transaccionales para acreditar, canjear, revertir y ajustar.
- ✅ **Etapa 3**: acceso del personal en `/entrar` (login, logout, roles y sucursal).
- ✅ **Etapa 4**: registro de clientes con código por correo, tarjeta con historial y QR temporal en `/tarjeta`.
- ✅ **Etapa 5**: barra unificada (`/barra`), movimientos y reversos (`/movimientos`), negocio (`/negocio`: panel, ventas y gastos, catálogo con Excel, programa, equipo, clientes) y tarjeta del cliente en vivo (`/tarjeta`).
- ✅ **Etapa 7 (Google)**: pase de Google Wallet que se actualiza con cada sello. Apple Wallet queda para producción.
- 🟡 **Etapa 8**: auditoría independiente y correcciones aplicadas (ver `docs/seguridad.md`); falta publicar (ver `docs/despliegue.md`).
- ⏳ Pendiente: sello NFC (etapa 6).

### Rutas principales
| Quién | Ruta |
|---|---|
| Público | `/` (página de venta de iautomexa Loyalty) · `/c/cafe-nomada` (página del piloto Café Nómada) |
| Cliente | `/tarjeta` (registro y acceso en `/tarjeta/acceso`) |
| Personal | `/entrar` → `/barra` · `/movimientos` · `/cuenta` |
| Administración | `/negocio` (panel) · `/negocio/finanzas` · `/negocio/catalogo` · `/negocio/programa` · `/negocio/equipo` · `/negocio/clientes` |

Todavía no hay NFC ni Wallet; la UI lo indica con claridad.

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
- [Despliegue](docs/despliegue.md)
- [Hoja de ruta](docs/hoja-de-ruta.md)
