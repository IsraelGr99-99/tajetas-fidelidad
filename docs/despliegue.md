# Despliegue en `loyalty.iautomexa.com`

Guía para publicar la demo en **Hostinger** con Next.js como servidor Node 22+. No basta un hosting de archivos estáticos porque la app tiene rutas y acciones de servidor. Esta fase es una **demo guiada con acceso por invitación**, no un SaaS de autoservicio. El Supabase de pruebas actual puede contener cuentas reales de prueba: no compartas credenciales de propietario ni abras la consola a visitantes anónimos.

## 1. Proyecto en el hosting
1. Confirma el plan: [Hostinger ofrece Node.js Web Apps en Business Web Hosting y Cloud](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/). En VPS el despliegue es manual. Si el plan no muestra **Web App**, no publiques esta aplicación como sitio estático.
2. En hPanel: **Websites → Create Website → Web App → Import Git Repository**. Usa este flujo de Node.js, no el menú Git para sitios PHP/HTML. Conecta `IsraelGr99-99/tajetas-fidelidad` y selecciona la rama validada de la demo (actualmente `feat/ui-landing`; `main` solo tras integrarla). [Guía oficial de Hostinger](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).
3. Confirma Next.js como framework; usa `npm run build` (este proyecto compila con Webpack) y `npm run start` si Hostinger solicita comandos. Selecciona Node 22.x. [Hostinger indica usar Webpack para Next.js 16.3.3+ por GLIBC](https://www.hostinger.com/support/how-to-fix-next-js-16-turbopack-build-errors-on-hostinger/). Revisa el log de despliegue antes de conectar el dominio.

## 2. Variables de entorno (Production)
Configúralas en **Website Dashboard → Environment variables** de la Node.js Web App; no subas `.env.local` ni pegues secretos en el repositorio. Los valores `NEXT_PUBLIC_*` se incorporan al build: si cambian, vuelve a desplegar. Las variables de servidor requieren reiniciar la app tras cambiarlas. [Guía oficial de variables de Hostinger](https://www.hostinger.com/support/how-to-edit-or-add-environment-variables-after-deployment/).

| Variable | Valor en producción | Secreta |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://loyalty.iautomexa.com` | no |
| `NEXT_PUBLIC_BUSINESS_URL` | `https://iautomexa.com` | no |
| `NEXT_PUBLIC_BUSINESS_SLUG` | `cafe-nomada` | no |
| `NEXT_PUBLIC_PHONE_AUTH_ENABLED` | `false` | no |
| `NEXT_PUBLIC_SUPABASE_URL` | la de tu proyecto | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | no |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | **sí** |
| `PURCHASE_REFERENCE_PEPPER` | genera uno **nuevo** y no lo cambies después | **sí** |
| `GOOGLE_WALLET_ISSUER_ID` | el de tu emisor | no |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64` | solo si ya tienes una cuenta de servicio configurada; de lo contrario, deja Wallet como no configurado | **sí** |
| `GOOGLE_WALLET_MODE` | `demo` (hasta que Google apruebe la emisión pública) | no |
| `GOOGLE_WALLET_LOGO_URL` | la de `.env.local` (bucket `marca`) | no |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ver paso 4 | no |

Generar el pepper:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Dominio
1. Primero publica en el dominio temporal de la Node.js Web App y verifica que `/` y `/entrar` cargan. Después, en el dashboard de la aplicación, usa **Connect domain** para `loyalty.iautomexa.com`.
2. Sigue los registros DNS que muestre Hostinger; si `iautomexa.com` usa nameservers externos, actualízalos en el proveedor DNS correspondiente. No copies un destino de otro hosting.
3. Espera a que el certificado HTTPS esté activo antes de probar cámara, registro o redirecciones de Auth. [Conectar dominio en Hostinger](https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/).

## 4. Supabase (proyecto en la nube)
- **Authentication → URL Configuration:**
  - Site URL: `https://loyalty.iautomexa.com`.
  - Redirect URLs: agrega `https://loyalty.iautomexa.com/**`.
- **Attack Protection → CAPTCHA:**
  1. Crea un widget Turnstile gratuito en Cloudflare, con el dominio de la demo y `localhost`.
  2. Pon su **Secret Key** en Supabase y activa CAPTCHA.
  3. Define `NEXT_PUBLIC_TURNSTILE_SITE_KEY` con la **Site Key**.
  4. Activa los dos lados juntos: si solo lo activas en Supabase, las altas fallan.
  5. En **Hostname Management** del widget agrega `loyalty.iautomexa.com` y, mientras desarrollas, `localhost`. Si falta el dominio, el widget muestra "No es posible conectarse al sitio web" (error **110200**). Quita `localhost` antes de producción.
  6. Las direcciones IP (por ejemplo `192.168.100.25`) no se pueden autorizar. Para probar desde el celular en la red local, usa el dominio publicado.
  7. Pruebas automáticas (Playwright): Cloudflare recomienda sus llaves de prueba (`1x00000000000000000000AA` y el secreto `1x0000000000000000000000000000000AA`) en un proyecto de Supabase de pruebas, no en el de producción.
- **Authentication → Multi-Factor:** confirma que TOTP está habilitado. Después, en `/cuenta`, activa tu verificación en dos pasos como propietario.
- **Authentication → Rate Limits:** con SMTP propio, sube "emails per hour" según tu plan de Resend. Mantén los demás límites.
- **Integrations → Cron:** confirma que existe el trabajo `fidelidad-limpieza-temporal`. Si no aparece, créalo con `select private.cleanup_ephemeral()` cada hora.
- **Datos de ejemplo:** `supabase/seed.sql` prepara un proyecto nuevo; `db push` no ejecuta el seed. Para el proyecto de pruebas actual, aplica `20261030120000_demo_catalog.sql` solo tras un respaldo nuevo de esquema y datos y la revisión del `dry-run` como indica [demo pública](demo-publica.md). No uses `db reset` remoto ni sustituyas datos existentes. El negocio debe seguir marcado `is_demo = true` mientras se muestren estos datos.
- **Reportes ficticios:** desde `/inicio`, el propietario puede generar 60 días de ventas importadas y gastos marcados DEMO. Se pueden borrar desde la misma sección. No se crean clientes, sellos ni ventas reales de caja.

## 5. Google Wallet para tus amigos
- En modo `demo`, agrega cada cuenta de Google que vaya a probar en **Google Pay & Wallet Console → Google Wallet API → Test accounts**.
- El enlace del pase abrirá `https://loyalty.iautomexa.com/tarjeta`.
- Para que cualquiera pueda guardarlo: *Request publishing access* y luego `GOOGLE_WALLET_MODE=public`.

## 6. Verificación después de publicar
- [ ] Solo hay acceso por invitación a la consola; ninguna contraseña de owner/admin se comparte con prospectos. La portada pública deja claro qué funciones aún no están integradas.
- [ ] Datos personales de pruebas revisados antes de dar acceso a cualquier tercero; si el entorno contiene datos no ficticios, no dar acceso a la consola hasta separarlos.
- [ ] `/inicio` muestra el recorrido y distingue los reportes DEMO; caja no presenta una venta de ejemplo como cobro real.
- [ ] `https://loyalty.iautomexa.com` carga la portada sin errores de CSP en la consola del navegador.
- [ ] `/` y `/en` tienen canonical al dominio final, `robots` permite indexarlas y `/sitemap.xml` solo enumera esas dos rutas. El panel, cuenta y tarjeta siguen `noindex`.
- [ ] Registro de cliente con código por correo; el QR aparece en `/tarjeta`.
- [ ] Login del personal en `/entrar`, barra con cámara (HTTPS permite usar la cámara del celular) y un sello registrado.
- [ ] El cliente ve "¡Sello registrado!" sin recargar.
- [ ] "Agregar a Google Wallet" con una cuenta de prueba y el pase actualizado después de otro sello.
- [ ] `/negocio` solo es accesible para owner/admin; con MFA activada pide el código.
- [ ] Cabeceras: `curl -I https://loyalty.iautomexa.com` muestra `content-security-policy` con `nonce-` y `strict-transport-security`.

## 7. Qué no está listo para producción
Revisa `docs/seguridad.md` → *Pendientes antes de producción* y `docs/hoja-de-ruta.md`. En resumen:
- MFA obligatoria.
- Pruebas de concurrencia en Supabase.
- Alertas de fraude interno.
- Aviso de privacidad revisado legalmente.
- Catálogo y logotipo reales.
- Apple Wallet.
- Cobro integrado con tarjeta e impresión física: siguen **no configurados**; no afirmar que funcionan en una promoción.
