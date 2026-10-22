# Guía de configuración externa

## Supabase

1. Crear un proyecto en Supabase y conservar la contraseña de base de datos en un gestor de secretos.
2. Instalar Supabase CLI y enlazar el proyecto (`supabase link`).
3. Aplicar `supabase/migrations/001_foundation.sql` con `supabase db push`.
4. Copiar la URL y la clave pública al `.env.local`. La clave `service_role` solo debe existir en procesos backend protegidos.
5. Configurar proveedores de Auth (email y SMS) cuando se decida el proveedor de mensajería. El MVP debe permitir elegir un solo canal verificado.

## Wallets

Apple requiere Apple Developer Program, Pass Type ID y certificado de Pass Type. Google requiere una cuenta de Google Wallet API, issuer aprobado para producción y una cuenta de servicio. Las integraciones se implementarán detrás de interfaces para que el producto muestre “no configurado” cuando falten estos valores.

## Dominio y despliegue

El dominio `fidelidad-demo.iautomexa.com` debe apuntar al proveedor de despliegue solo después de una revisión del piloto. Antes de publicar: configurar variables de producción, HTTPS, límites de tasa, logs sin PII, copias de seguridad y una política de eliminación de datos.
