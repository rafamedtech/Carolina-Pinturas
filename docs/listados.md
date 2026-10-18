# Listados reutilizables

Ventas, productos, clientes, proveedores, pagos, compras, gastos, igualaciones y
repartidores componen la misma estructura desde `app/components/list/`.

Se usan componentes con slots, autoimportados por Nuxt. El layout `default`
sigue siendo responsable de la navegación global. Cada módulo conserva sus
consultas, tipos, permisos y acciones: no se necesita un nuevo layout, layer ni
un esquema de configuración que intente describir toda la lógica del negocio.

## Piezas

| Componente | Responsabilidad y contrato |
| --- | --- |
| `ListPage` | Panel, título, botón Actualizar y error. Recibe `id`, `title`, `loading`, `error` booleano, `errorTitle` y `errorMessage`; emite `refresh`. Slots: `actions`, `toolbar`, `views`, contenido por defecto, `pagination` y `overlays`. |
| `ListToolbar` | Buscador adaptable y limpieza. `v-model:search`, `placeholder`, `hasActiveFilters`; emite `clear`. Slots `filters` y `actions` para los controles propios del módulo. El módulo decide qué valores limpiar. |
| `ListViews` | Selector en móvil y pestañas en escritorio, sincronizados con un mismo `v-model`. Recibe `items` con `label`/`value` y una etiqueta accesible `label`. |
| `ListTable<T>` | Tabla Nuxt UI tipada, skeleton, estado vacío y estilo común. Recibe `data: T[]`, `columns: TableColumn<T>[]`, `loading`, `empty` y `meta`. Admite `@select(event, row)`, `v-model:sorting` y `v-model:column-visibility`. |
| `ListPagination` | Rango de registros y navegación adaptable. `v-model:page`, `totalResults`, `pageSize`, `label`, `loading`; `filteredTotal` y `totalLabel` opcionales para totales en MXN. |

`ListPage` mantiene visibles los filtros, las acciones y los overlays si falla
la consulta. Oculta el contenido y la paginación mientras se muestra el error.
El botón Actualizar sigue disponible para reintentar.

## Paginación y consultas

- **Servidor (ventas, igualaciones, pagos y gastos):** el módulo envía su página
  y filtros a la API; `ListTable` recibe únicamente los resultados de esa página,
  sin `v-model:page`. `ListPagination` usa el total que devuelve la API.
- **Catálogos completos (clientes, proveedores, compras y repartidores):**
  `ListTable` recibe todos los resultados filtrados junto con `v-model:page` y
  `page-size`. TanStack ordena el conjunto antes de paginar. La página se ajusta
  cuando disminuyen los resultados y se conserva durante una carga inicial vacía.
- **Productos:** conserva su paginación local previa a la tabla, compartida con
  las tarjetas móviles y la consulta de unidades de los productos visibles.

Los módulos usan `useTableQuery` para restaurar filtros/página/orden desde la URL,
reiniciar la página al filtrar y conservar `returnTo` al abrir un detalle. No
agregues otro estado global para el listado. Las exportaciones reciben el conjunto
filtrado completo o `fetchAllPages`, nunca solo la página visible.

Las tarjetas móviles y los modales específicos siguen en los componentes de cada
módulo. Para fechas se reutilizan los selectores de calendario del proyecto y
`app/utils/datetime.ts`; los filtros mantienen sus valores ISO.

## Ejemplo de composición

```vue
<ListPage
  id="catalogo"
  title="Catálogo"
  :loading="loading"
  :error="Boolean(error)"
  :error-message="message"
  @refresh="refresh()"
>
  <template #actions>
    <!-- Exportación y acciones secundarias del módulo -->
  </template>
  <template #toolbar>
    <ListToolbar
      v-model:search="search"
      placeholder="Buscar registro"
      :has-active-filters="Boolean(search)"
      @clear="search = ''"
    >
      <template #actions>
        <!-- Alta específica del módulo -->
      </template>
    </ListToolbar>
  </template>
  <ListTable
    v-model:page="page"
    :data="filteredRecords"
    :columns="columns"
    :page-size="25"
    :loading="loading"
    empty="No hay registros para mostrar."
    @select="openRecord"
  />
  <template #pagination>
    <ListPagination
      v-model:page="page"
      label="registros"
      :total-results="filteredRecords.length"
      :page-size="25"
      :loading="loading"
    />
  </template>
</ListPage>
```

Referencias: [componentes de Nuxt](https://nuxt.com/docs/4.x/directory-structure/app/components),
[layouts de Nuxt](https://nuxt.com/docs/4.x/directory-structure/app/layouts),
[DashboardPanel](https://ui.nuxt.com/docs/components/dashboard-panel),
[Table](https://ui.nuxt.com/docs/components/table) y
[Pagination](https://ui.nuxt.com/docs/components/pagination) de Nuxt UI.
