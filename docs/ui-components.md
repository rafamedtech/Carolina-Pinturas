# Componentes compartidos de interfaz

El detalle de producto (`app/pages/productos/[id]/index.vue`) es la referencia visual: cards sutiles, iconos semánticos, títulos compactos, datos en dos columnas y acciones adaptadas a móvil. Los componentes se autoimportan con los nombres de esta guía.

`AppButton`, `DetailCard`, `DetailFields`, `DetailHeader`, `DetailPageHeader`, `DetailSectionHeading`, `DetailStatCard`, `DetailTable`, `ListLoading`, `ListTable`, `ListColumnPicker`, `ListRecordCard`, `ReportsBreakdownCard`, `ReportsMonthPace`, `ReportsRankingCard`, `ReportsSalesChannels`, `ReportsSectionHeading` y `ReportsSummaryCards` se mantienen en la Nuxt Layer `@rafamedtech/nuxt-shared`.

Antes de crear o modificar una pantalla, revisa este catálogo y `app/components/detail`, `app/components/list` y los componentes `App*`. Reutiliza el patrón existente y amplía su contrato cuando sea necesario. Los componentes de presentación reciben props/slots; permisos, consultas y acciones de negocio pertenecen al consumidor.

| Componente | Uso y contrato |
| --- | --- |
| `ListRecordCard` | Card de Nuxt Shared de registro móvil basada en pedidos y construida sobre `DetailCard`. Props: `title`, `eyebrow?` (código o fecha ya formateada), `to?`, `titleTo?` (enlace solo en el título), `actionable?`, `ariaLabel?`, `fields?` (mismo contrato de campos de `DetailFields`), `summaryLabel?`, `summaryValue?`, `summaryColor?` (`neutral`/`primary`), `summaryStacked?` (etiqueta encima del valor). Slots: `title-extra` para contenido debajo del título, `field-value` (`{ field }`) para personalizar valores, `summary-leading` para un dato a la izquierda del resumen, `trailing` para estado, `actions` para controles independientes, `default` para reemplazar los campos, `summary` para personalizar el valor del resumen y `footer` para controles debajo del resumen. Evento `select` en modo `actionable` sin `to`. La tarjeta enlazada usa un enlace nativo; la accionable, un botón nativo. |
| `StatusBadge` | Badge sutil de Nuxt Shared. Recibe `label`, `color`, `icon?` y `size?`. `OrdersOrderStatusBadge` adapta el catálogo local de pedidos. |
| `PaymentSummary` | Resumen de cobros de Nuxt Shared. Recibe `amounts` con `total?`, `paid` y `balance` ya formateados, `balanceColor`, `layout?` (`rows` o `columns`), `totalLabel?` y `balanceLabel?`. El slot `actions` muestra los controles autorizados por el consumidor. Si se omite `amounts`, solo se muestran las acciones habilitadas. |
| `DetailHeader` | Barra superior con `title`, `titleIcon?`, `back?` (regreso con `to` y `label` accesible), `showSidebarCollapse?`, `loading?`, `refreshLabel?` y `showRefresh?`. Emite `refresh`. Usa `#actions` para controles en la barra y `#breadcrumbs` para montar `DetailBreadcrumbs` debajo de la barra. |
| `DetailBreadcrumbs` | Barra de migas de pan con `UBreadcrumb`. Recibe `items` de Nuxt UI. Se usa en los detalles de producto, cliente, pedido y orden de compra. |
| `DetailPageHeader` | Título del contenido y acciones de escritorio. Conserva las props y slots de `UPageHeader`: `title`, `description`, `links`, etc. Slots habituales: `title`, `description`, `links`. Usa `#title` para imagen, código y menú móvil. |
| `DetailCard` | Card informativa basada en `UPageCard`, con `variant="subtle"` por defecto. Conserva sus props, slots y `ui`: `title`, `icon`, `description`, `#title`, `#default`, `#footer`, etc. Usa `variant="naked"` para secciones sin superficie. |
| `InventoryValuationDetails` | Vista de Nuxt Shared que recibe `valuation` de P33 y muestra importes por moneda, costos pendientes y desglose por almacén. Usa `DetailStatCard`, `DetailTable` y `ListRecordCard`. El adaptador local `InventoryValuation` aporta el encabezado de Inventario. |
| `ReportsBreakdownCard` | Desglose con importes compactos MXN y porcentajes. Recibe filas `ReportBreakdownItem`, título, descripción, icono, color de barra y texto e icono de vacío. Opciones: `countLabel(count)`, `uppercaseValues`, `limit` (8 por defecto), `ui.title` y slot `footer`. |
| `ReportsCashFlowChart` | Gráfica de cliente con barras de ventas, compras de material y gastos operativos, y línea de tendencia semanal. Recibe `movements` con fecha, etiqueta e importes por periodo, `annual`, `labels` opcionales y `ui.title`. El adaptador local agrupa los movimientos y aplica el formato de fechas de Pinturas. |
| `ReportsMonthPace` | Avance y proyección mensual o anual en MXN. Recibe `period` con modo y días transcurridos/totales, y `metrics` con ventas actuales, ventas anteriores y días del periodo anterior. Pinturas configura `ui.title` con `text-base`. |
| `ReportsProfitStatementCard` | Estado de resultados en MXN con filas, barras, variación y desglose por cada $100 vendidos. Recibe `metrics` de tipo `ReportProfitStatementMetrics`, `title`, `description`, `caption` y `salesLabel`. El adaptador define los textos según la base fiscal del reporte. `annual` cambia la etiqueta del periodo anterior. Usa `DetailTable` y `ListRecordCard` para escritorio y móvil. `compact` conserva la lista móvil de CVR y `loading` presenta skeletons. |
| `ReportsRankingCard` | Ranking numerado en el orden de las filas `ReportRankingItem` recibidas. Recibe `countLabel(count)` y el mensaje `empty`. Admite importes exactos con `exactAmounts`, color `material` y slot `summary`. Pinturas configura `ui.title` con `text-base`. |
| `ReportsSalesChannels` | Dona y leyenda accesible con importe en MXN, porcentaje, número de ventas y comparación con el periodo anterior. El dashboard pasa `channels` con `previousAmount` por canal y configura `ui.title` con `text-base`. |
| `ReportsSectionHeading` | Encabezado de reporte con `id` sobre el `h2` para `aria-labelledby`, `title`, clase `marker` e importe opcional en MXN. `loading` sustituye el importe por un skeleton. `#actions` admite controles del consumidor. Pinturas usa `ui.root` con `flex-nowrap` y `ui.title` con `text-base tracking-tight`. |
| `ReportsSummaryCards` | Cuadrícula de métricas basada en `DetailStatCard`. Recibe filas `ReportSummaryCard` y `previousPeriod`. El adaptador de Pinturas aporta «Ventas netas», valores, detalles y dirección favorable. |
| `ReportsPeriodControls` | Control mensual/anual de Nuxt Shared sobre `CalendarMonthPicker`. Usa los modelos `month` y `view`, recibe zona, formato de mes y límites opcionales. Emite `select` al elegir un periodo. El adaptador local configura el formato y los límites de Pinturas. La página conserva la URL y el dashboard conserva la consulta y sus secciones. |
| `DetailSectionHeading` | Encabezado de sección con `h2`. Props: `title`, `description?`, `hideTitleOnMobile?`, `titleId?` (para `aria-labelledby`), `color?` (`neutral` por defecto o `primary`). Slot `leading` para un marcador decorativo antes del título; slot `actions` para botones o controles junto al encabezado, con ajuste de línea en móvil. Conserva `ui` de `DetailCard`. |
| Selectores de calendario | `OrderDatePicker`, `OrderDateRangePicker` y `HomeMonthPicker` adaptan `CalendarDatePicker`, `CalendarRangePicker` y `CalendarMonthPicker` de Nuxt Shared. Conservan el formato mexicano de cada vista. El filtro de pedidos aplica al completar el rango o elegir un preset, permite limpiar y descarta una selección incompleta al cerrar. Los presets de 7, 14 y 30 días incluyen hoy. |
| `DetailFields` | Lista semántica `dl` de etiqueta/valor en dos columnas, con skeletons y `—` para valores vacíos. Props: `fields`, `loading?`, `columns?` (`1`–`4`, `2` por defecto; `3` y `4` se adaptan desde móvil). Cada campo acepta `key?`, `label`, `value?` (`string`/`number`/`null`) y `fullWidth?`. Slots `label` y `value` (`{ field }`) para personalizar la etiqueta y el valor. Conserva el valor `0`. Entrega fechas y monedas ya formateadas. |
| `DetailStatCard` | Métrica compacta. Props: `title`, `icon?`, `value?`, `unit?`, `loading?`, `valueColor?` (`primary`/`neutral`). Slots `title` y `value` para conservar marcadores o valores compuestos; slot por defecto para contenido adicional. |
| `DetailTabs` | Pestañas de sección con etiquetas adaptables y tooltip opcional. `v-model` string; `items: { label, value, icon?, description? }[]`, `content?`, `fullWidth?` (por defecto, `true`); slot `content`. |
| `ListToolbar` y `ListFiltersDialog` | Nuxt Shared aporta búsqueda, limpieza y un diálogo con borrador. `ListToolbar` conecta `v-model:search` y emite `clear`. `ListFiltersModal` aporta los campos de Pinturas y aplica el borrador al confirmar. |
| `ListPagination` y `ListCreateButton` | Nuxt Shared presenta el rango, las páginas y el botón de alta. Cada listado configura su total, tamaño de página, permisos y destinos. |
| `ListViews` | Selector en móvil y pestañas `link` alineadas a la izquierda en escritorio. `ListLayout` coloca estas vistas antes de la barra de filtros con separación compacta y conserva la selección al quitar filtros. |
| `ListLoading` | Indicador de carga con `label`, `size` (`sm`/ `md`/ `lg`), `variant` (`list`/ `table`) y clases `ui.root`, `ui.icon`, `ui.label`. Recibe `loading` para activar el anuncio en una región persistente y `announce` para desactivar el anuncio de una copia visual. |
| `ListTable` | Tabla responsiva de Nuxt Shared. Comparte las filas de la página y su orden entre escritorio y móvil. Expone las columnas al selector externo y acepta paginación local con el modelo `page`. |
| `ListLayout` | Layout de listados sobre `ListTable`. Usa `#record="{ row }"` para renderizar un `ListRecordCard` por fila bajo `md`, con carga y vacío compartidos. Usa `#mobile="{ rows }"` para personalizar la lista completa. Ambos slots reciben las filas de la página y el orden de la tabla. |
| `DetailTable` | Tabla de detalle con estado vacío, visibilidad de columnas y slots de `UTable`. Props: `data`, `columns`, `empty?`, `getRowId?`, `loading?`, `ui?` (combina con los estilos base); `v-model:column-visibility`; expone `getColumns()`. Su slot opcional `#record="{ row }"` muestra tarjetas bajo `md` y reutiliza la carga y el vacío de la tabla. |
| `AppNumberInput` | Campo numérico de Nuxt Shared sobre `UInputNumber`. En compras, cantidad y costo unitario admiten seis decimales sin ajuste al paso. Al borrar el campo, el modelo queda en `undefined`. El costo unitario oculta los botones de incremento y decremento. |
| `AppPhoneInput` | Campo de Nuxt Shared con un `v-model` de hasta diez dígitos. La edición de cliente usa `format="digits"` y conserva su propio `UFormField` y reglas de validación. |
| `SiigoMexicoLocationFields` | Selectores dependientes de Nuxt Shared. La edición de cliente configura los nombres `stateCode` y `cityCode`, la etiqueta Ciudad y los adaptadores que muestran los códigos de Pinturas. Al seleccionar otro estado se limpia la ciudad. Al cargar un domicilio se respetan ambos modelos. |
| `AppButton` | Botón/enlace basado en `UButton`. Añade `intent` y conserva todas sus props, slots, atributos ARIA y `@click`. `primary` (defecto): primary/solid; `secondary`: neutral/outline; `danger`: error/soft; `quiet`: neutral/ghost. `color`/`variant` explícitos tienen prioridad. El tamaño sigue el tema global. |
| `AppCsvExportButton` | Acción de la capa Nuxt Shared. El listado entrega el nombre, las columnas y las filas en memoria o una función que obtiene todas las páginas filtradas mediante su API habitual. |
| `DestructiveConfirmModal` | Confirmación de Nuxt Shared con `v-model:open`, título, descripción y acciones configurables. Usa `#context` para identificar el registro y `#reason="{ loading }"` si el flujo admite un motivo. El consumidor atiende `@confirm`, controla la petición y pasa `loading` y el mensaje `error`. Mientras carga, el modal bloquea la confirmación y el cierre. |
| `UserMenuBase` | Disparador y menú de identidad de Nuxt Shared. `UserMenu` aporta el nombre, rol, icono y grupos de acciones. El submenú de apariencia, el permiso de Configuración y el cierre de sesión pertenecen al adaptador local. |
| `AuthFormCard` | Tarjeta de Nuxt Shared con ancho adaptable y slot opcional `header`. El adaptador `AuthCard` aporta el encabezado de Carolina Pinturas. Cada página controla su formulario, sus alertas y su navegación. |
| `MoneyFormFields` | Gastos conectan moneda, tasa e importe a sus modelos de formulario. Pinturas conserva la tasa fija para MXN, moneda como campo `currencyCode` y sus reglas de escala. |
| `ListResponsive` y `RetryAlert` | `ListTable` compone tabla y tarjetas. `ListPage` conecta el reintento a la consulta local. El listado mantiene los filtros, columnas y paginación locales. |
| `CustomerPicker` | Ventas configura opciones, búsqueda y alta de cliente. Conserva la etiqueta de la selección al actualizar las opciones. |
| `DashboardShell` y `AppErrorPage` | El layout conserva sus enlaces, grupos, permisos y menú. La vista de error presenta el código de Nuxt y la navegación de regreso en español. |
| `AuthEmailField`, `AuthPasswordFields` y `AuthRecoveryNotice` | Los formularios de recuperación y actualización de contraseña conservan sus esquemas y acciones locales. |
| `ReportsSkeleton` | Cuadrículas y paneles de carga. La vista controla qué secciones presenta y anuncia la carga una vez. |

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

- Para registros en listas móviles usa `ListRecordCard`; usa el slot `#record` de `ListLayout` o `DetailTable` para integrar las tarjetas con su tabla. Si la vista requiere un breakpoint propio, un formulario o una distribución especial, el consumidor controla cuándo mostrarlas y cómo mostrar la carga y el estado vacío. El componente no incluye consultas, permisos ni formatos de moneda o fecha. Usa `to` para navegar o `actionable` + `@select` para abrir una vista/modal. Pon botones o enlaces adicionales en `#actions` o `#footer`. Ambos slots quedan por encima del enlace o botón de la card sin anidar controles interactivos. Ajusta bordes, espaciado y tipografía en `app/components/list/ListRecordCard.vue` de Nuxt Shared para aplicar el estilo global. `OrderListCards` es la referencia de integración, también para igualaciones.
- Las superficies de las cards usan el token `bg-card`: `#fcfcfc` en modo claro y `#1c1b1e` en oscuro, definido en `app/assets/css/main.css` y aplicado a las variantes `outline`, `soft` y `subtle` de `UPageCard` mediante `app/app.config.ts`.
- Usa estos componentes siempre que exista un patrón equivalente; no copies sus clases en páginas ni crees variantes específicas por módulo para el mismo patrón.
- Para listados completos reutiliza `ListPage`, `ListToolbar`, `ListTable`, `ListPagination` y los demás componentes de `app/components/list`.
- «Quitar filtros» conserva la pestaña de `ListLayout`, restablece los valores iniciales configurados y vuelve a la primera página. En «Pendiente de pago» vuelve a ocultar cancelados y cotizaciones.
- Usa Nuxt UI directamente cuando el catálogo no cubra el caso (formularios, calendarios, alertas, overlays, etc.). Si aparece un nuevo patrón transversal, extráelo y agrégalo aquí.
- Personaliza con props/slots y después con `ui`/`class` para necesidades puntuales. Cambia el componente compartido si debe cambiar el patrón en todas las pantallas; el tema general vive en `app/app.config.ts`.
- `DetailPageHeader` oculta las acciones de `#links` en móvil: proporciona un menú accesible dentro de `#title` o `#description` cuando haya acciones. Verifica escritorio y móvil, nombres accesibles en botones de solo icono, estados de carga y valores vacíos.
- Usa colores semánticos de Nuxt UI, Composition API y TypeScript. Sigue la regla de fechas de `AGENTS.md`.
- Al tocar una pantalla existente, migra los patrones equivalentes de la parte modificada. No hace falta migrar módulos ajenos al cambio.
