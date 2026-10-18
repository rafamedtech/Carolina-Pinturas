# Layout configurable de listados

`ListLayout<T>` en `app/components/list/ListLayout.vue` compone el panel, el
buscador, el calendario, Más filtros, Nuevo, las pestañas, la tabla tipada, la
carga y la paginación. Las páginas entregan su configuración, filas y columnas.
El layout global `default` conserva la navegación de la aplicación.

Lo usan ventas, igualaciones, productos, clientes, proveedores, pagos, compras,
gastos, repartidores, cuentas por pagar e inventario. También se usa con
`embedded` en los pedidos del cliente/proveedor y las entregas del repartidor.
Las tablas internas del inventario comparten `ListTable`.

## Configuración

El contrato `ListLayoutConfig` vive en `app/types/list.ts`:

| Campo | Uso |
| --- | --- |
| `id`, `title`, `empty` | Identidad, título y mensaje vacío. |
| `search: { placeholder }` | Activa el buscador. |
| `dateFilter: { subject }` | Activa el selector de rango del proyecto. |
| `filters` | Campos de Más filtros: `select` con opciones, `checkbox` o `date`. Cada campo tiene `key`, `label`, `type` y `defaultValue`. |
| `tabs`, `defaultTab` | Pestañas `label`/`value` y valor de limpieza (por defecto `all`). En móvil se muestran como selector. |
| `create` | Botón Nuevo: `label`, `icon`, `to`, `disabled`, `reason`; con `items` se convierte en un menú Nuxt UI. Sin enlace ni menú, emite `create` para abrir el formulario del módulo. |
| `pagination` | `mode`, `label`, `pageSize` (25 por defecto), `totalLabel` opcional. |

Las opciones omitidas no se renderizan. Los permisos se resuelven en el módulo:
puede omitir `create`, deshabilitarlo o entregar únicamente las opciones permitidas.

## Datos, modelos y eventos

- `data: T[]` y `columns: TableColumn<T>[]` conservan los tipos del módulo.
- `loading` muestra **un único spinner y “Cargando” debajo**, tanto en escritorio
  como en móvil. Oculta los datos anteriores durante la carga.
- `error`, `errorTitle`, `errorMessage` muestran la advertencia; los controles y
  Actualizar siguen disponibles para reintentar.
- Modelos: `search`, `dateRange`, `filters`, `tab`, `page`, `sorting`,
  `columnVisibility`. El módulo sigue siendo dueño de las consultas y la URL.
- Eventos: `refresh`, `create`, `clear`, `select(event, row)`.
- `totalResults` y `filteredTotal` alimentan el pie del listado.
- `meta` conserva clases y comportamiento de filas, como los vencimientos de compras.
- `embedded` renderiza una sección dentro de un detalle, sin otro panel de dashboard.

`useListFilterBindings` adapta refs existentes al modelo `filters` sin duplicar
estado. `useListTableColumns<T>` centraliza los encabezados ordenables. Los
composables `useOrderListTable`, `usePaymentListTable` y `useExpenseListTable`
definen las columnas de cada dominio; no montan otra tabla.

## Filtros y fechas

Más filtros usa un borrador. Cancelar descarta cambios; Aplicar filtros emite
una sola actualización y vuelve a la página 1. Limpiar filtros dentro del modal
solo cambia el borrador. Quitar filtros en el listado restablece búsqueda,
fechas, pestaña, valores por defecto y página.

Los campos de fecha usan los calendarios reutilizables del proyecto. Los modelos
mantienen ISO y los textos visibles usan los formateadores de `app/utils/datetime.ts`.
Productos conserva sus cuatro límites de creación/actualización en Más filtros;
el rango principal y los límites de creación comparten el mismo estado.

## Paginación y slots

- `server`: la API entrega la página visible; se pasa su `totalResults`.
- `client`: la tabla recibe el catálogo completo y ordena antes de paginar.
- `external`: el módulo ya recortó las filas; se pasa el total filtrado. Productos
  lo usa para compartir la misma página con las tarjetas y resolver sus unidades.

`useTableQuery` conserva filtros, orden, página y `returnTo`. Las exportaciones
reciben todos los resultados filtrados o `fetchAllPages`, no solo la página visible.

Slots disponibles: `actions` (exportación y acciones del encabezado), `before`
(resúmenes), `mobile` (tarjetas específicas), `after`, `overlays` (formularios del
módulo). `content` reemplaza únicamente la presentación de registros cuando se
necesitan grupos o tarjetas especiales, como en inventario y cuentas agrupadas;
la carga y los controles continúan a cargo del layout.

## Ejemplo

```vue
<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import type { TableColumn } from '@nuxt/ui'

interface Product { id: string; name: string }
const search = ref('')
const page = ref(1)
const rows = ref<Product[]>([])
const columns: TableColumn<Product>[] = [{ accessorKey: 'name', header: 'Producto' }]
const config: ListLayoutConfig = {
  id: 'catalogo', title: 'Catálogo', empty: 'No hay registros.',
  search: { placeholder: 'Buscar producto' },
  create: { label: 'Nuevo producto', to: '/productos/nuevo' },
  pagination: { mode: 'client', label: 'productos' }
}
</script>

<template>
  <ListLayout
    v-model:search="search"
    v-model:page="page"
    :config="config"
    :data="rows"
    :columns="columns"
  />
</template>
```

La búsqueda y los filtros modifican los modelos; el módulo los aplica a su
consulta o catálogo local. El layout no adivina campos ni cambia APIs del negocio.

Referencias: [componentes de Nuxt](https://nuxt.com/docs/4.x/directory-structure/app/components),
[DashboardPanel](https://ui.nuxt.com/docs/components/dashboard-panel),
[Table](https://ui.nuxt.com/docs/components/table),
[Modal](https://ui.nuxt.com/docs/components/modal) y
[DropdownMenu](https://ui.nuxt.com/docs/components/dropdown-menu) de Nuxt UI.
