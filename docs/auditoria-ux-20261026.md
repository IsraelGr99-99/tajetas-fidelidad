# Auditoría heurística de UX · consola Loyalty

Fecha: 26 de octubre de 2026. Alcance: acceso del personal, inicio, catálogo, inventario y resumen del negocio. Esta revisión se basa en recorridos de código y pruebas automatizadas; **no sustituye una sesión de usabilidad con propietarios, cajeros y gerentes**.

## Hallazgos y cambios realizados

| Prioridad | Hallazgo observado | Cambio |
| --- | --- | --- |
| Alta | El acceso mostraba la identidad y el lenguaje de Café Nómada, pero llevaba a la consola multiempresa de Loyalty. «Inicia tu turno» tampoco describía bien a un propietario. | Acceso con identidad iautomexa Loyalty, mensaje válido para todos los roles y distinción visible entre contraseña e invitación por correo. Sin métricas inventadas. |
| Alta | Inventario mezclaba lista, alta, movimiento, receta e importación en una sola pantalla larga. La lista de insumos carecía de búsqueda y acción directa. | Tres vistas explícitas: consultar stock, gestionar insumos y configurar recetas. Tabla buscable con estado por sucursal y botón «Ajustar» por fila. Alta, movimiento e importación ya no compiten por atención. |
| Alta | La preparación del negocio enviaba a una ruta genérica y contaba recetas de productos inactivos, por lo que podía quedar permanentemente pendiente. | Enlaces profundos a la tarea concreta y cálculo de preparación solo sobre productos activos. |
| Media | El resumen ponía indicadores de POS importado junto a ventas de caja, aunque no son la misma fuente. | El panel semanal de caja permanece visible; análisis histórico/importado queda en una sección opcional con su fuente explicada. |
| Media | El catálogo priorizaba importación y calculadora, dejando el listado y el alta manual por debajo. | Lista y alta manual primero, acciones directas y enlace al paso siguiente (recetas). Importación y calculadora quedan como tareas secundarias. |
| Media | Tras crear un insumo, el flujo no guiaba a cargar su existencia. | La respuesta devuelve el ID del insumo; la interfaz abre el ajuste de existencias y recuerda el insumo creado. |
| Media | La verificación CAPTCHA podía dejar un espacio visual sin contexto mientras cargaba. | Se rotuló explícitamente la verificación y se agrupó visualmente para que el usuario entienda qué está esperando. |
| Media | El selector de forma de entrar se marcaba como pestañas sin implementar su navegación de teclado ni paneles asociados. | Ahora son botones agrupados con estado `aria-pressed`, acordes con su comportamiento real. |

## Flujos de referencia

1. Configuración inicial: catálogo → insumos → recetas por producto/variante → existencia por sucursal → caja.
2. Operación: registrar venta cobrada en caja → aplicar fidelidad con el mismo folio cuando el cliente participe → consultar ventas y movimientos.
3. Reabastecimiento: inventario → buscar insumo → «Ajustar» → motivo y cantidad → revisar estado.

## Segunda pasada: claridad y limpieza

- Clientes: la búsqueda estaba después del padrón completo. Ahora es la primera acción, con etiqueta visible y explicación breve sobre correo exacto y privacidad.
- Inventario: la lista de insumos y su buscador quedaron antes de los indicadores; se quitó el contador repetido. Las tres vistas ya no aparentan ser pasos obligatorios. Se eliminó el selector de sucursal duplicado dentro del formulario de ajuste; la sucursal activa se muestra en texto.
- Alta de insumo: la respuesta exitosa incorpora inmediatamente el artículo a la lista local mientras se refrescan los datos del servidor, y abre el registro de existencias con ese artículo seleccionado. No se inventa una existencia.
- Catálogo: se eliminó el enlace «Ver productos» que llevaba al listado inmediatamente siguiente. El formulario pasó de cinco columnas estrechas a dos, usa etiquetas de operación y guía hacia la receta después de crear un producto.
- Ventas: el historial reciente se divide en páginas de 15 filas con navegación que conserva el filtro de sucursal.
- Reportes: las opciones para generar datos de demostración siguen disponibles, pero plegadas para que no compitan con las tareas habituales.
- Diseño: navegación lateral clara, superficies translúcidas sobre fondo luminoso, acciones con color y foco de teclado visible. La transparencia es decorativa; el texto mantiene fondo claro de alto contraste y la animación respeta movimiento reducido.
- Código retirado: `SectionTabs`, `WalletPhone` y `DashboardPreview` no tenían referencias fuera de sus propios archivos. No se tocó la base de datos, los archivos de usuario ni funcionalidades con uso comprobado.

## Riesgos y trabajo posterior

- Caja y fidelidad aún son dos registros separados. El enlace entre ambas pantallas ayuda, pero falta conciliación transaccional de folio/venta para evitar dobles capturas y errores de operación.
- La paginación actual del catálogo e inventario ocurre en el navegador. Para miles de artículos convendrá filtrado y paginación del servidor, manteniendo las reglas de acceso.
- Falta una prueba de usabilidad con al menos un propietario y un operador de caja, usando tareas reales y observando dónde se detienen; esta auditoría no mide tiempos ni éxito de usuarios.
- Falta validar visualmente el interior de la consola con una sesión de propietario en móvil y escritorio después del despliegue. Las pruebas automatizadas sin credenciales cubren el acceso y las redirecciones, no la pantalla autenticada.
- La integración física de impresoras ESC/POS y los envíos promocionales siguen pendientes de hardware/credenciales y reglas comerciales. Ninguna interfaz debe presentarlos como activos.
