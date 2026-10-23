# Despliegue en `fidelidad-demo.iautomexa.com`

Guía para publicar la demo. Está escrita para **Vercel** (plan gratuito, soporte nativo de Next.js 16); en otro hosting con Node 20+ los pasos equivalen.

## 1. Proyecto en el hosting
1. Importa el repositorio `IsraelGr99-99/tajetas-fidelidad`, rama `feat/fundamentos` (o `main` cuando la fusiones).
2. Framework: Next.js. Build: `npm run build`. Node 20 o superior.
3. Región cercana a tu proyecto Supabase.

## 2. Variables de entorno (Production)
Cópialas desde `.env.local`, salvo las marcadas como **nuevas para producción**. Configura como *Sensitive* las que son secretas.

| Variable | Valor en producción | Secreta |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://fidelidad-demo.iautomexa.com` (**nueva**) | no |
| `NEXT_PUBLIC_BUSINESS_URL` | `https://iautomexa.com` | no |
| `NEXT_PUBLIC_BUSINESS_SLUG` | `cafe-nomada` | no |
| `NEXT_PUBLIC_PHONE_AUTH_ENABLED` | `false` | no |
| `NEXT_PUBLIC_SUPABASE_URL` | la de tu proyecto | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | no |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | **sí** |
| `PURCHASE_REFERENCE_PEPPER` | genera uno **nuevo** y no lo cambies después | **sí** |
| `GOOGLE_WALLET_ISSUER_ID` | el de tu emisor | no |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64` | el mismo de `.env.local` | **sí** |
| `GOOGLE_WALLET_MODE` | `demo` (hasta que Google apruebe la emisión pública) | no |
| `GOOGLE_WALLET_LOGO_URL` | la de `.env.local` (bucket `marca`) | no |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ver paso 4 | no |

Generar el pepper:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Dominio
1. En el hosting agrega el dominio `fidelidad-demo.iautomexa.com`.
2. En el DNS de `iautomexa.com` (Hostinger) crea el registro que indique el hosting. En Vercel normalmente es `CNAME fidelidad-demo → cname.vercel-dns.com`.
3. Espera a que el certificado HTTPS quede activo.

## 4. Supabase (proyecto en la nube)
- **Authentication → URL Configuration:**
  - Site URL: `https://fidelidad-demo.iautomexa.com`.
  - Redirect URLs: agrega `https://fidelidad-demo.iautomexa.com/**`.
- **Attack Protection → CAPTCHA:**
  1. Crea un widget Turnstile gratuito en Cloudflare, con el dominio de la demo y `localhost`.
  2. Pon su **Secret Key** en Supabase y activa CAPTCHA.
  3. Define `NEXT_PUBLIC_TURNSTILE_SITE_KEY` con la **Site Key**.
  4. Activa los dos lados juntos: si solo lo activas en Supabase, las altas fallan.
  5. En **Hostname Management** del widget agrega `fidelidad-demo.iautomexa.com` y, mientras desarrollas, `localhost`. Si falta el dominio, el widget muestra "No es posible conectarse al sitio web" (error **110200**). Quita `localhost` antes de producción.
  6. Las direcciones IP (por ejemplo `192.168.100.25`) no se pueden autorizar. Para probar desde el celular en la red local, usa el dominio publicado.
  7. Pruebas automáticas (Playwright): Cloudflare recomienda sus llaves de prueba (`1x00000000000000000000AA` y el secreto `1x0000000000000000000000000000000AA`) en un proyecto de Supabase de pruebas, no en el de producción.
- **Authentication → Multi-Factor:** confirma que TOTP está habilitado. Después, en `/cuenta`, activa tu verificación en dos pasos como propietario.
- **Authentication → Rate Limits:** con SMTP propio, sube "emails per hour" según tu plan de Resend. Mantén los demás límites.
- **Integrations → Cron:** confirma que existe el trabajo `fidelidad-limpieza-temporal`. Si no aparece, créalo con `select private.cleanup_ephemeral()` cada hora.
- **Seed:** el negocio está marcado como demo (`is_demo = true`), así que se ve el aviso de demostración. Para el piloto real, cambia a `false` y reemplaza el catálogo de ejemplo.

## 5. Google Wallet para tus amigos
- En modo `demo`, agrega cada cuenta de Google que vaya a probar en **Google Pay & Wallet Console → Google Wallet API → Test accounts**.
- El enlace del pase abrirá `https://fidelidad-demo.iautomexa.com/tarjeta`.
- Para que cualquiera pueda guardarlo: *Request publishing access* y luego `GOOGLE_WALLET_MODE=public`.

## 6. Verificación después de publicar
- [ ] `https://fidelidad-demo.iautomexa.com` carga la portada sin errores de CSP en la consola del navegador.
- [ ] Registro de cliente con código por correo; el QR aparece en `/tarjeta`.
- [ ] Login del personal en `/entrar`, barra con cámara (HTTPS permite usar la cámara del celular) y un sello registrado.
- [ ] El cliente ve "¡Sello registrado!" sin recargar.
- [ ] "Agregar a Google Wallet" con una cuenta de prueba y el pase actualizado después de otro sello.
- [ ] `/negocio` solo es accesible para owner/admin; con MFA activada pide el código.
- [ ] Cabeceras: `curl -I https://fidelidad-demo.iautomexa.com` muestra `content-security-policy` con `nonce-` y `strict-transport-security`.

## 7. Qué no está listo para producción
Revisa `docs/seguridad.md` → *Pendientes antes de producción* y `docs/hoja-de-ruta.md`. En resumen:
- MFA obligatoria.
- Pruebas de concurrencia en Supabase.
- Alertas de fraude interno.
- Aviso de privacidad revisado legalmente.
- Catálogo y logotipo reales.
- Apple Wallet.
