# Café Nómada · Fidelidad

Sistema de fidelidad digital para el piloto de Café Nómada en San Pedro Cholula. La aplicación está diseñada como una base multiempresa: el negocio, sucursal, actor y programa siempre serán parte del contexto de autorización.

## Estado actual

Etapa 1 completada: base Next.js + TypeScript estricto, landing responsive y configuración de entorno sin secretos. La landing es una vista de producto; no simula registros, sellos ni integraciones Wallet.

## Ejecutar localmente

```bash
npm install
copy .env.example .env.local
npm run dev
```

## Credenciales que faltan

1. **Supabase:** crea un proyecto en [supabase.com](https://supabase.com), copia `Project URL` a `NEXT_PUBLIC_SUPABASE_URL` y `anon public key` a `NEXT_PUBLIC_SUPABASE_ANON_KEY`. La `service_role key` se coloca únicamente en `.env.local` del servidor y nunca se publica.
2. **Apple Wallet:** primero se necesita una cuenta Apple Developer, un Pass Type ID y un certificado para firmar pases. Los valores se guardarán como variables de servidor; la llave privada no debe entrar a Git.
3. **Google Wallet:** crea un issuer en Google Pay & Wallet Console, una cuenta de servicio con permisos mínimos y guarda su JSON como secreto en `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON`.
4. **Dominio:** cuando exista el despliegue autorizado, `NEXT_PUBLIC_APP_URL` será `https://fidelidad-demo.iautomexa.com`.

## Próximo bloque

La siguiente etapa implementará migraciones de Supabase con empresas, sucursales, usuarios, campañas versionadas, ledger append-only, idempotencia y políticas RLS. Las credenciales no son necesarias para escribir las migraciones; sí lo serán para ejecutar y verificar contra un proyecto real.

## Límites declarados

No hay emisión real de tarjetas Wallet, autenticación, acreditación de visitas ni datos demo en producción todavía. No se deben presentar como integrados hasta conectar y probar las credenciales correspondientes.
