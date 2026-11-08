# Instrucciones del repositorio

## Pruebas en navegador

- Cuando una tarea requiera probar o verificar algo en un navegador, usa el Google Chrome del usuario.
- Antes de abrir una pestaña o pedir iniciar sesión, revisa las pestañas abiertas de todos los perfiles o conexiones de Google Chrome disponibles y busca una sesión autenticada del proyecto, especialmente en `http://localhost:3000`. El usuario mantiene una sesión iniciada: reutiliza esa pestaña y ese mismo perfil para las pruebas.
- Solo si no encuentras una sesión autenticada después de revisar Chrome, abre la página en Chrome para que el usuario pueda iniciar sesión y, una vez autenticado, continúa las pruebas en esa misma sesión.
- No solicites ni captures credenciales del usuario.

## Campos de fecha

- Cada vez que implementes un campo de fecha, usa el componente de calendario de Nuxt UI mediante el selector de fecha reutilizable del proyecto.
- Para mostrar fechas, usa `formatDate`, `formatDateTime` o `formatDateRange` de `app/utils/datetime.ts` (en código compartido o servidor, de `shared/utils/datetime.ts`). El formato visible es `DD/MM/AAAA`; agrega `HH:mm` cuando se necesite la hora. No crees formateadores locales en los componentes.
- Conserva `YYYY-MM-DD` e ISO en los valores de calendarios, filtros, API y base de datos. Las fechas sin hora deben conservar su día; los timestamps se muestran en la zona de México.

## Componentes reutilizables y consistencia visual (obligatorio)

- El detalle de producto es la referencia visual del proyecto. Antes de implementar o modificar una interfaz, lee `docs/ui-components.md` y revisa los componentes existentes en `app/components/detail`, `app/components/list` y `App*`.
- Siempre que una card, título, encabezado, botón, métrica, lista de datos, pestaña o tabla corresponda a un patrón existente, usa su componente compartido (`DetailCard`, `DetailPageHeader`, `DetailSectionHeading`, `AppButton`, `DetailFields`, `DetailStatCard`, `DetailHeader`, `DetailTabs`, `DetailTable` o los componentes `List*`). No dupliques su markup/clases ni crees equivalentes por módulo.
- Usa props y slots para variar contenido y comportamiento. Si falta una capacidad reutilizable, amplía el componente compartido manteniendo compatibilidad; si surge un patrón transversal nuevo, créalo sobre Nuxt UI y documenta su contrato en `docs/ui-components.md`.
- Usa Nuxt UI directamente para casos que el catálogo no cubra. Mantén colores semánticos y separa la presentación de permisos, peticiones y lógica de negocio.
- Al modificar pantallas existentes, aplica esta regla en la parte intervenida. Verifica estados de carga/vacíos, accesibilidad y adaptación a escritorio y móvil.
