# Componentes compartidos de interfaz

El detalle de producto (`app/pages/productos/[id]/index.vue`) es la referencia visual: cards sutiles, iconos semánticos, títulos compactos, datos en dos columnas y acciones adaptadas a móvil. Los componentes se autoimportan con los nombres de esta guía.

Antes de crear o modificar una pantalla, revisa este catálogo y `app/components/detail`, `app/components/list` y los componentes `App*`. Reutiliza el patrón existente y amplía su contrato cuando sea necesario. Los componentes de presentación reciben props/slots; permisos, consultas y acciones de negocio pertenecen al consumidor.

| Componente | Uso y contrato |
| --- | --- |
| `ListRecordCard` | Card de registro móvil basada en pedidos y construida sobre `DetailCard`. Props: `title`, `eyebrow?` (fecha ya formateada), `to?`, `titleTo?` (enlace solo en el título), `actionable?`, `ariaLabel?`, `fields?` (mismo contrato de campos de `DetailFields`), `summaryLabel?`, `summaryValue?`, `summaryColor?` (`neutral`/`primary`). Slots: `field-value` (`{ field }`) para personalizar valores, `summary-leading` para un dato a la izquierda del resumen, `trailing` para estado, `actions` para controles independientes, `default` para reemplazar los campos y `summary` para un resumen personalizado. Evento `select` en modo `actionable` sin `to`. La tarjeta enlazada usa un enlace nativo; la accionable, un botón nativo. |
| `DetailHeader` | Barra superior con título, breadcrumbs y botón de actualización. Props: `title`, `breadcrumbs?`, `loading?`, `refreshLabel?` (`Actualizar` por defecto), `showRefresh?` (`true` por defecto; `false` para barras con controles propios sin actualización). Evento `refresh`; slot `actions`. |
| `DetailPageHeader` | Título del contenido y acciones de escritorio. Conserva las props y slots de `UPageHeader`: `title`, `description`, `links`, etc. Slots habituales: `title`, `description`, `links`. Usa `#title` para imagen, código y menú móvil. |
| `DetailCard` | Card informativa basada en `UPageCard`, con `variant="subtle"` por defecto. Conserva sus props, slots y `ui`: `title`, `icon`, `description`, `#title`, `#default`, `#footer`, etc. Usa `variant="naked"` para secciones sin superficie. |
| `DetailSectionHeading` | Encabezado de sección con `h2`. Props: `title`, `description?`, `hideTitleOnMobile?`, `titleId?` (para `aria-labelledby`), `color?` (`neutral` por defecto o `primary`). Slot `leading` para un marcador decorativo antes del título; slot `actions` para botones o controles junto al encabezado, con ajuste de línea en móvil. Conserva `ui` de `DetailCard`. |
| `DetailFields` | Lista semántica `dl` de etiqueta/valor en dos columnas, con skeletons y `—` para valores vacíos. Props: `fields`, `loading?`, `columns?` (`1`–`4`, `2` por defecto; `3` y `4` se adaptan desde móvil). Cada campo acepta `key?`, `label`, `value?` (`string`/`number`/`null`) y `fullWidth?`. Slots `label` y `value` (`{ field }`) para personalizar la etiqueta y el valor. Conserva el valor `0`. Entrega fechas y monedas ya formateadas. |
| `DetailStatCard` | Métrica compacta. Props: `title`, `icon?`, `value?`, `unit?`, `loading?`, `valueColor?` (`primary`/`neutral`). Slots `title` y `value` para conservar marcadores o valores compuestos; slot por defecto para contenido adicional. |
| `DetailTabs` | Pestañas de sección con etiquetas adaptables y tooltip opcional. `v-model` string; `items: { label, value, icon?, description? }[]`, `content?`; slot `content`. |
| `DetailTable` | Tabla de detalle con estado vacío, visibilidad de columnas y slots de `UTable`. Props: `data`, `columns`, `empty?`, `getRowId?`, `ui?` (combina con los estilos base); `v-model:column-visibility`; expone `getColumns()`. |
| `AppButton` | Botón/enlace basado en `UButton`. Añade `intent` y conserva todas sus props, slots, atributos ARIA y `@click`. `primary` (defecto): primary/solid; `secondary`: neutral/outline; `danger`: error/soft; `quiet`: neutral/ghost. `color`/`variant` explícitos tienen prioridad. El tamaño sigue el tema global. |

## Ejemplo

```vue
<ListRecordCard
  title="PED-000123"
  :eyebrow="formatDate(order.orderDate)"
  :to="`/ventas/${order.id}`"
  :aria-label="`Abrir pedido de ${order.customer.name}`"
  :fields="[{ label: 'Cliente', value: order.customer.name, fullWidth: true }]"
  summary-label="Total"
  :summary-value="formattedTotal"
>
  <template #trailing>
    <OrdersOrderStatusBadge :status="order.status" />
  </template>
</ListRecordCard>

<DetailPageHeader title="Detalle del cliente">
  <template #links>
    <AppButton intent="secondary" label="Duplicar" icon="i-lucide-copy" @click="duplicate" />
    <AppButton label="Editar" icon="i-lucide-pencil" :to="editPath" />
  </template>
</DetailPageHeader>

<DetailCard title="Información general" icon="i-lucide-info">
  <DetailFields :fields="fields" :loading="loading" />
</DetailCard>

<DetailSectionHeading title="Actividad" description="Historial de operaciones" />
```

## Criterios de uso

- El resumen de inventario compone `InventorySummaryMetrics`, `InventoryValuation` e `InventoryRecentMovements`. Reciben datos tipados por props y emiten `view` para que el consumidor controle la navegación y los filtros. Reutilizan `DetailStatCard`, `DetailCard`, `DetailFields`, `DetailTable`, `ListRecordCard` y `AppButton`; no ejecutan consultas. Los indicadores cuentan productos únicos o registros de producto/almacén según su etiqueta, nunca mezclan unidades ni monedas.

- Para registros en listas móviles usa `ListRecordCard`; el listado decide cuándo ocultarse (`md:hidden`, `sm:hidden`, etc.) y muestra `ListLoading` o su estado vacío. El componente no incluye consultas, permisos ni formatos de moneda o fecha. Usa `to` para navegar o `actionable` + `@select` para abrir una vista/modal. Pon botones o enlaces adicionales en `#actions`, que queda por encima del enlace/botón de la card sin anidar controles interactivos. `OrderListCards` es la referencia de integración, también para igualaciones.
- Las superficies de las cards usan el token `bg-card`: `#fcfcfc` en modo claro y `#1c1b1e` en oscuro, definido en `app/assets/css/main.css` y aplicado a las variantes `outline`, `soft` y `subtle` de `UPageCard` mediante `app/app.config.ts`.
- Usa estos componentes siempre que exista un patrón equivalente; no copies sus clases en páginas ni crees variantes específicas por módulo para el mismo patrón.
- Para listados completos reutiliza `ListPage`, `ListToolbar`, `ListTable`, `ListPagination` y los demás componentes de `app/components/list`.
- `ListLayoutConfig.resetTabOnClear` permite conservar la pestaña activa al quitar filtros con `false`; en ese caso, cambiar de pestaña por sí solo no activa «Quitar filtros». Por defecto se conserva la limpieza completa, incluida la pestaña.
- Usa Nuxt UI directamente cuando el catálogo no cubra el caso (formularios, calendarios, alertas, overlays, etc.). Si aparece un nuevo patrón transversal, extráelo y agrégalo aquí.
- Personaliza con props/slots y después con `ui`/`class` para necesidades puntuales. Cambia el componente compartido si debe cambiar el patrón en todas las pantallas; el tema general vive en `app/app.config.ts`.
- `DetailPageHeader` oculta las acciones de `#links` en móvil: proporciona un menú accesible dentro de `#title` o `#description` cuando haya acciones. Verifica escritorio y móvil, nombres accesibles en botones de solo icono, estados de carga y valores vacíos.
- Usa colores semánticos de Nuxt UI, Composition API y TypeScript. Sigue la regla de fechas de `AGENTS.md`.
- Al tocar una pantalla existente, migra los patrones equivalentes de la parte modificada. No hace falta migrar módulos ajenos al cambio.
