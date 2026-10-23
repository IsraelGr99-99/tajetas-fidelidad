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
5. **Authentication → Providers → Email**: activa “Confirm email”; **Email OTP Length = 8** y **Email OTP Expiration = 600** s. La app acepta códigos de 6 a 10 dígitos.
6. **Authentication → URL Configuration**: Site URL y redirects (`http://localhost:3000/**`, `https://fidelidad-demo.iautomexa.com/**`).
7. Alta del primer propietario: crea el usuario en **Authentication → Users** y luego, en SQL Editor:
   ```sql
   insert into public.staff_members (business_id, user_id, role, display_name)
   values ('00000000-0000-4000-8000-000000000001', '<uuid-del-usuario>', 'owner', 'Nombre');
   ```

### Correo con Resend (SMTP de capa gratuita)
El SMTP integrado de Supabase no sirve para clientes reales: solo envía a miembros del equipo y con un límite muy bajo.

1. Crea una cuenta en [resend.com](https://resend.com). En la capa gratuita, a la fecha: 3,000 correos al mes y 100 al día.
2. **Domains → Add domain**: usa un subdominio de envío, por ejemplo `notificaciones.iautomexa.com`. Así no afectas el correo principal del dominio.
3. Agrega en el DNS de `iautomexa.com` los registros que muestra Resend: MX y TXT de SPF del subdominio, TXT de DKIM (`resend._domainkey…`) y, opcional, DMARC. Espera a que aparezcan como *Verified*.
4. Conecta con Supabase. Elige una de dos vías:
   - **Integración oficial**: Resend → *Integrations → Supabase* → elige el proyecto. Configura el SMTP sola.
   - **Manual**: Resend → *API Keys* → crea una llave con permiso **Sending access** limitado al dominio. Luego, en Supabase → **Authentication → Emails → SMTP Settings**, llena estos datos:
     - Host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la API key.
     - Remitente `no-responder@notificaciones.iautomexa.com`, nombre `Café Nómada`.
5. **Authentication → Emails → Templates**: en *Confirm signup* y en *Magic Link*, asunto “Tu código de Café Nómada” y como cuerpo el contenido de `supabase/templates/codigo.html`. Usa `{{ .Token }}`, sin enlace.
6. **Authentication → Rate Limits**: sube el límite de correos por hora; con SMTP propio, el valor por defecto es bajo. Para el piloto bastan 30–60 por hora.
7. Prueba: el primer envío real lo hacemos juntos, con tu correo, al terminar la etapa 4.

La API key de Resend es un secreto. Solo vive en Supabase y en el gestor de secretos; nunca en `.env.example`, en Git ni en chats.
- **Teléfono**: no hay SMS gratuito real. Para demostraciones internas usa números de prueba de Supabase Auth (**Phone → Test OTP**) o el crédito de prueba de Twilio (solo números verificados). Para clientes reales se necesita un proveedor con costo por mensaje (Twilio Verify, MessageBird, Vonage).

### Secretos de la app
- `PURCHASE_REFERENCE_PEPPER`: genera uno por entorno (`node -e "console.log(require(crypto).randomBytes(48).toString(base64url))"`) y guárdalo en el gestor de secretos del hosting. No lo cambies después de abrir el piloto (ver ADR-013).

## 2. Apple Wallet (etapa 7)
Requiere Apple Developer Program. Crear un **Pass Type ID** (`pass.com.iautomexa.fidelidad`), generar su certificado, descargar el certificado WWDR G4 y una llave APNs (.p8). Guardar en el gestor de secretos del hosting como base64 (`APPLE_*` en `.env.example`). La llave privada nunca va a Git.

## 3. Google Wallet (etapa 7) — integrado
En Google Pay & Wallet Console crear el issuer, habilitar Google Wallet API en Google Cloud, crear una cuenta de servicio con permiso mínimo de emisor y guardar su JSON en base64 (`GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64`). Mientras Google no apruebe la emisión pública, `GOOGLE_WALLET_MODE=demo` (solo cuentas de prueba).

**Probar en modo demo:** Google Pay & Wallet Console → Google Wallet API → *Manage* → **Test accounts**: agrega las cuentas de Google con las que se probará (las de quien guarde el pase). Otra cuenta verá un error de Google al guardar.

**Para emisión pública:** en la misma consola, solicita acceso de publicación (*Request publishing access*), completa el perfil del negocio y cambia `GOOGLE_WALLET_MODE=public`. La clase ya se crea en `UNDER_REVIEW` y Google la aprueba.

**Logotipo:** `GOOGLE_WALLET_LOGO_URL` debe ser una URL HTTPS pública. Hoy apunta al bucket público `marca` de Supabase Storage. Si cambia el logotipo oficial, sube el PNG nuevo (mínimo 660×660, cuadrado) con el mismo nombre.

**Enlace del pase:** el pase lleva a `NEXT_PUBLIC_APP_URL/tarjeta`. En local es `localhost`, así que el enlace solo funciona desde esta computadora; en el despliegue será `https://fidelidad-demo.iautomexa.com/tarjeta`.

## 4. Dominio y despliegue (no publicar sin autorización)
- Hosting sugerido: Vercel (soporte nativo de Next.js). Alternativas: cualquier Node 20+.
- DNS: registro `CNAME fidelidad-demo` → destino que indique el hosting.
- Variables de producción en el gestor de secretos; `NEXT_PUBLIC_APP_URL=https://fidelidad-demo.iautomexa.com`.
- Antes de publicar: completar la lista de `docs/hoja-de-ruta.md` (sección “Antes del piloto”).
