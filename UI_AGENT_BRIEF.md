# Encargo exclusivo de UI/UX — Loyalty de iautomexa

Este archivo aplica **solo** al worktree `ui-only-redesign`, rama `feat/ui-only-redesign`, creado desde `feat/multitenant-core` (`a4f5c96`). Lee también `AGENTS.md` antes de empezar. No trabajes en el checkout principal ni cambies de rama. Si otro agente modifica este worktree, preserva sus cambios y coordina antes de editarlos.

## Objetivo

Diseñar una experiencia clara, atractiva y profesional para Loyalty de iautomexa. El producto es multiempresa: las empresas ficticias de la demo son Norte Barber Studio y Brisa Helados; **Café Nómada es un piloto legado, no la identidad de la demo**. La consola debe resultar comprensible para personas con poca experiencia digital, sin esconder las acciones frecuentes detrás de páginas largas o lenguaje técnico. Mantén la marca Loyalty/iautomexa, la landing en español e inglés y la consola en español de México.

## Sí puedes hacer

- Auditar visualmente las pantallas y mejorar jerarquía, navegación, estados vacíos, formularios, mensajes de ayuda y responsive. Da prioridad a `/entrar`, `/negocio`, `/caja`, `/negocio/catalogo`, `/negocio/inventario`, `/negocio/ventas`, `/negocio/finanzas`, `/negocio/programa`, `/negocio/equipo`, `/tarjeta/acceso` y las rutas públicas de tarjeta. La landing `/` y `/en` puede pulirse sin alterar su propósito ni sus CTA.
- Editar JSX/TSX **solo en la capa de presentación** de `src/app` y `src/components`, hojas CSS y recursos visuales estáticos de `public` cuando sea necesario. Puedes extraer componentes presentacionales reutilizables. Conserva las props y los contratos de las acciones existentes.
- Mejorar textos de interfaz que expliquen qué hacer, qué ocurrió y qué dato es ficticio. Los estados de pago, impresoras, MFA y otros servicios sin configurar deben seguir siendo honestos.
- Mantener y hacer más visibles los controles de sucursal, búsqueda, paginación, edición de productos y enlace directo a la receta exacta. Mejora el orden de tareas y el foco, sin cambiar qué datos se consultan o guardan.
- Usar CSS/animaciones discretas con `prefers-reduced-motion`; cuidar contraste, teclado, foco visible, semántica HTML, etiquetas y mensajes para lectores de pantalla. Evita efectos que ralenticen caja o interfieran con formularios.
- Ejecutar `npm run check`, `npm run build` y, si cambias flujos navegables, las pruebas E2E pertinentes. Documenta capturas y observaciones sin incluir PII ni secretos. Puedes hacer commits **solo en esta rama**.

## Completamente prohibido en este encargo

- Editar `supabase/**`, `src/actions/**`, `src/domain/**`, `src/lib/**`, `tests/db/**`, políticas RLS, RPC, migraciones, seeds o tablas. No ejecutar SQL ni tocar ningún proyecto Supabase, Storage o datos reales/ficticios.
- Cambiar lógica de caja, precios, costos, stock, recetas, sellos, elegibilidad, permisos, roles, autenticación, MFA, consentimiento, privacidad o validaciones. No modificar importes ni hacer que una operación aparente éxito si el servidor no lo confirmó.
- Cambiar rutas, redirecciones, parámetros, nombres de variables de entorno, API, integraciones, pagos, impresoras o archivos de configuración/dependencias. No instalar paquetes ni añadir librerías de animación sin autorización explícita del propietario y la justificación exigida en `docs/decisiones.md`.
- Eliminar avisos de datos simulados, seguridad, accesibilidad, estados de error o información legal. No sustituir el piloto legado por la demo ni mezclar información de empresas.
- Entrar con credenciales ajenas, copiar secretos, usar datos personales en capturas, aplicar cambios a Hostinger, publicar el sitio, hacer `push`, merge o PR, o cambiar `main`/`integration`, salvo instrucción directa posterior del propietario.

Si una mejora de UI parece requerir modificar lógica o base de datos, **detente en ese punto**, anota la dependencia y propone el cambio; no lo implementes en este worktree.

## Entregable y criterio de aceptación

1. Breve inventario de problemas de UX observados, con severidad y pantalla.
2. Cambios visuales consistentes entre desktop y móvil, con un flujo claro para localizar una función, introducir datos, corregir errores y volver al contexto anterior.
3. Antes/después de las pantallas principales; verifica teclado, tamaño táctil, foco y movimiento reducido.
4. `npm run check` y `npm run build` en verde, o explica exactamente qué quedó bloqueado. Reporta los archivos tocados y confirma que no modificaste lógica, datos ni servicios externos.

No integres esta rama por tu cuenta. El propietario revisará el diseño antes de llevarlo a `integration`.
