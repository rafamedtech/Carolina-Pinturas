# Instrucciones del repositorio

## Pruebas en navegador

- Cuando una tarea requiera probar o verificar algo en un navegador, usa el Google Chrome del usuario.
- Si la página requiere autenticación, abre la página en Chrome para que el usuario pueda iniciar sesión y, una vez autenticado, continúa las pruebas en esa misma sesión.
- No solicites ni captures credenciales del usuario.

## Campos de fecha

- Cada vez que implementes un campo de fecha, usa el componente de calendario de Nuxt UI mediante el selector de fecha reutilizable del proyecto.
- Para mostrar fechas, usa `formatDate`, `formatDateTime` o `formatDateRange` de `app/utils/datetime.ts` (en código compartido o servidor, de `shared/utils/datetime.ts`). El formato visible es `DD/MM/AAAA`; agrega `HH:mm` cuando se necesite la hora. No crees formateadores locales en los componentes.
- Conserva `YYYY-MM-DD` e ISO en los valores de calendarios, filtros, API y base de datos. Las fechas sin hora deben conservar su día; los timestamps se muestran en la zona de México.
