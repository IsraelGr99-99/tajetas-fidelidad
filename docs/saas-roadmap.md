# De piloto a SaaS: iautomexa Loyalty

Estado: diagnóstico de producto, no promesa de disponibilidad. El backend contiene bases multiempresa, pero la experiencia actual todavía está anclada al piloto Café Nómada en rutas, sesión del personal, textos y configuración.

Avance del primer corte (rama `feat/multitenant-core`): selección explícita de empresa para personal, rutas de tarjeta por `slug`, alta controlada de negocios DEMO y pruebas de aislamiento. Sigue **pendiente** el registro público autónomo de la primera empresa, el aviso/consentimiento por negocio, límites/planes, cobro de suscripción y despliegue validado. Por ello no debe anunciarse como SaaS listo para contratar.

## Diferenciación real

Woncards comunica tarjetas diseñables, Apple/Google Wallet, notificaciones y estadísticas para negocios. Loyalty no debe presentarse como superior por tener solo una tarjeta digital: su oportunidad es conectar **venta verificada → inventario/receta → fidelidad → margen y recompra**, con un flujo sencillo para el personal. Las funciones de Wallet y mensajes solo deben mostrarse como operativas cuando tengan credenciales, aprobación y pruebas reales.

Referencia oficial: <https://woncards.com/>.

## P0: imprescindible antes de vender como SaaS

1. **Alta autónoma de negocios:** registro, verificación, creación de empresa/sucursal/owner, invitaciones y guía inicial; sin intervención manual ni constantes del piloto. Aislamiento por empresa probado en todas las RPC, Storage y exportaciones.
2. **Enrutamiento multiempresa:** slug/subdominio o dominio del negocio, selección de empresa para personal con varias membresías, tarjetas y landing por negocio, datos/marca/consentimiento propios.
3. **Planes y facturación:** catálogo de planes, prueba, límites claros, cobro de la suscripción, facturas, vencimiento, reintentos, cancelación y períodos de gracia. La fidelidad nunca se debe borrar al suspender un plan.
4. **Operación confiable:** respaldos con restauración ensayada, migraciones reversibles, monitoreo, alertas, métricas, soporte, página de estado, procedimientos de incidentes y SLA medible.
5. **Seguridad y privacidad:** MFA obligatorio para roles privilegiados, revisión independiente de RLS/RPC/Storage, pruebas de concurrencia, retención y eliminación por empresa, exportación de datos, aviso y consentimiento revisados legalmente, auditoría de accesos y separación de secretos por entorno.
6. **Caja de producción:** devoluciones, cancelaciones, corte y conciliación por sucursal/empleado; permisos para ajustes; tickets reales probados con impresora; idempotencia y recuperación tras caídas/red intermitente.
7. **Pagos con tarjeta integrados:** proveedor presencial disponible en México, cuenta comercial y terminal por negocio, asociación sucursal-terminal, webhooks firmados, estado pendiente/aprobado/fallido, conciliación, reversos y pruebas de doble cobro. No sumar inventario ni fidelidad por un pago solo iniciado. El registro manual actual no equivale a cobrar.

## P1: para competir de forma creíble

- Apple Wallet y Google Wallet productivos, con pases firmados, actualización tras eventos del ledger, certificados y monitoreo de expiración. Mantener tarjeta web como alternativa accesible.
- Constructor de tarjeta por negocio con logo, colores, contraste, vista previa y pruebas en móvil; campañas con versiones y simulación de recompensa antes de publicar.
- Notificaciones y campañas consentidas: segmentos, límites de frecuencia, baja fácil, plantillas, entregabilidad y medición de conversión sin inventar atribución.
- Analítica útil: recurrencia, cohortes, margen real por producto, costo de recompensas, ventas por sucursal/empleado y exportaciones verificables.
- Onboarding guiado y ayuda contextual: primera sucursal, catálogo, recetas, venta de prueba, QR y primera recompensa; lenguaje sencillo para personal no técnico.

## P2: expansión

- Integraciones contables/POS, API pública con claves por negocio y webhooks firmados.
- Dominios propios, traducciones por negocio y roles más finos.
- Motor de experimentos de fidelidad y recomendaciones con explicaciones; no atribuir a IA decisiones de saldo o elegibilidad.

## Decisión de pago presencial

Stripe Terminal no lista México entre sus países disponibles; no activarlo en el piloto de Puebla sin confirmación oficial de disponibilidad. Si se elige otro proveedor, validar su documentación, hardware, tarifas, contratos y entorno de pruebas antes de diseñar la integración. Referencias: <https://docs.stripe.com/terminal/payments/regional> y <https://www.mercadopago.com.mx/developers/es/docs/mp-point-legacy/overview> (la documentación indica usar Orders API para integraciones nuevas).
