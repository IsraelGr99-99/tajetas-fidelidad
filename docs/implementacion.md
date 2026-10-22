# Configuración externa

## 1. Supabase (proyecto en la nube)

1. En el dashboard: **Project Settings → API Keys**. Copia a `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`)
   - `SUPABASE_SECRET_KEY` (`sb_secret_…`, solo servidor)
2. Enlaza la CLI (pide tu token de acceso y la contraseña de la base de datos; no las compartas en chats):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   ```
3. Revisa y aplica migraciones:
   ```bash
   npx supabase db push --dry-run
   npx supabase db push
   ```
4. Carga los datos iniciales (solo en un proyecto nuevo; los precios son de ejemplo): SQL Editor → pega `supabase/seed.sql`.
5. **Authentication → Providers → Email**: activa “Confirm email”; OTP de 6 dígitos y caducidad de 600 s.
6. **Authentication → URL Configuration**: Site URL y redirects (`http://localhost:3000/**`, `https://fidelidad-demo.iautomexa.com/**`).
7. Alta del primer propietario: crea el usuario en **Authentication → Users** y luego, en SQL Editor:
   ```sql
   insert into public.staff_members (business_id, user_id, role, display_name)
   values ('00000000-0000-4000-8000-000000000001', '<uuid-del-usuario>', 'owner', 'Nombre');
   ```

### Verificación gratuita para el demo
- **Correo (recomendado para el piloto)**: SMTP propio de capa gratuita (Resend o Brevo) en **Authentication → Emails → SMTP Settings**. Requiere verificar el dominio de envío (registros DNS en `iautomexa.com`). El SMTP integrado de Supabase no sirve para clientes reales.
- **Teléfono**: no hay SMS gratuito real. Para demostraciones internas usa números de prueba de Supabase Auth (**Phone → Test OTP**) o el crédito de prueba de Twilio (solo números verificados). Para clientes reales se necesita un proveedor con costo por mensaje (Twilio Verify, MessageBird, Vonage).

## 2. Apple Wallet (etapa 7)
Requiere Apple Developer Program. Crear un **Pass Type ID** (`pass.com.iautomexa.fidelidad`), generar su certificado, descargar el certificado WWDR G4 y una llave APNs (.p8). Guardar en el gestor de secretos del hosting como base64 (`APPLE_*` en `.env.example`). La llave privada nunca va a Git.

## 3. Google Wallet (etapa 7)
En Google Pay & Wallet Console crear el issuer, habilitar Google Wallet API en Google Cloud, crear una cuenta de servicio con permiso mínimo de emisor y guardar su JSON en base64 (`GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64`). Mientras Google no apruebe la emisión pública, `GOOGLE_WALLET_MODE=demo` (solo cuentas de prueba).

## 4. Dominio y despliegue (no publicar sin autorización)
- Hosting sugerido: Vercel (soporte nativo de Next.js). Alternativas: cualquier Node 20+.
- DNS: registro `CNAME fidelidad-demo` → destino que indique el hosting.
- Variables de producción en el gestor de secretos; `NEXT_PUBLIC_APP_URL=https://fidelidad-demo.iautomexa.com`.
- Antes de publicar: completar la lista de `docs/hoja-de-ruta.md` (sección “Antes del piloto”).
