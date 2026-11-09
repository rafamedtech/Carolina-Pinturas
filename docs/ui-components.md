# Componentes compartidos de interfaz

El detalle de producto (`app/pages/productos/[id]/index.vue`) es la referencia visual: cards sutiles, iconos semánticos, títulos compactos, datos en dos columnas y acciones adaptadas a móvil. Los componentes se autoimportan con los nombres de esta guía.

Antes de crear o modificar una pantalla, revisa este catálogo y `app/components/detail`, `app/components/list` y los componentes `App*`. Reutiliza el patrón existente y amplía su contrato cuando sea necesario. Los componentes de presentación reciben props/slots; permisos, consultas y acciones de negocio pertenecen al consumidor.

| Componente | Uso y contrato |
| --- | --- |
| `DetailHeader` | Barra superior con título, breadcrumbs y botón de actualización. Props: `title`, `breadcrumbs?`, `loading?`, `refreshLabel`. Evento `refresh`; slot `actions`. |
| `DetailPageHeader` | Título del contenido y acciones de escritorio. Conserva las props y slots de `UPageHeader`: `title`, `description`, `links`, etc. Slots habituales: `title`, `description`, `links`. Usa `#title` para imagen, código y menú móvil. |
| `DetailCard` | Card informativa basada en `UPageCard`, con `variant="subtle"` por defecto. Conserva sus props, slots y `ui`: `title`, `icon`, `description`, `#title`, `#default`, `#footer`, etc. Usa `variant="naked"` para secciones sin superficie. |
| `DetailSectionHeading` | Encabezado de sección con `h2`. Props: `title`, `description?`, `hideTitleOnMobile?`, `titleId?` (para `aria-labelledby`), `color?` (`neutral` por defecto o `primary`). Slot `leading` para un marcador decorativo antes del título; conserva `ui` de `DetailCard`. |
| `DetailFields` | Lista semántica `dl` de etiqueta/valor en dos columnas, con skeletons y `—` para valores vacíos. Props: `fields`, `loading?`. Cada campo acepta `key?`, `label`, `value?` (`string`/`number`/`null`) y `fullWidth?`. Conserva el valor `0`. Entrega fechas y monedas ya formateadas. |
| `DetailStatCard` | Métrica compacta. Props: `title`, `icon?`, `value?`, `unit?`, `loading?`, `valueColor?` (`primary`/`neutral`). Slot por defecto para contenido adicional. |
| `DetailTabs` | Pestañas de sección con etiquetas adaptables y tooltip opcional. `v-model` string; `items: { label, value, icon?, description? }[]`, `content?`; slot `content`. |
| `DetailTable` | Tabla de detalle con estado vacío, visibilidad de columnas y slots de `UTable`. Props: `data`, `columns`, `empty?`, `getRowId?`; `v-model:column-visibility`; expone `getColumns()`. |
| `AppButton` | Botón/enlace basado en `UButton`. Añade `intent` y conserva todas sus props, slots, atributos ARIA y `@click`. `primary` (defecto): primary/solid; `secondary`: neutral/outline; `danger`: error/soft; `quiet`: neutral/ghost. `color`/`variant` explícitos tienen prioridad. El tamaño sigue el tema global. |

## Ejemplo

```vue
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

- Las superficies de las cards usan el token `bg-card`: `#fcfcfc` en modo claro y `#1c1b1e` en oscuro, definido en `app/assets/css/main.css` y aplicado a las variantes `outline`, `soft` y `subtle` de `UPageCard` mediante `app/app.config.ts`.
- Usa estos componentes siempre que exista un patrón equivalente; no copies sus clases en páginas ni crees variantes específicas por módulo para el mismo patrón.
- Para listados completos reutiliza `ListPage`, `ListToolbar`, `ListTable`, `ListPagination` y los demás componentes de `app/components/list`.
- Usa Nuxt UI directamente cuando el catálogo no cubra el caso (formularios, calendarios, alertas, overlays, etc.). Si aparece un nuevo patrón transversal, extráelo y agrégalo aquí.
- Personaliza con props/slots y después con `ui`/`class` para necesidades puntuales. Cambia el componente compartido si debe cambiar el patrón en todas las pantallas; el tema general vive en `app/app.config.ts`.
- `DetailPageHeader` oculta las acciones de `#links` en móvil: proporciona un menú accesible dentro de `#title` o `#description` cuando haya acciones. Verifica escritorio y móvil, nombres accesibles en botones de solo icono, estados de carga y valores vacíos.
- Usa colores semánticos de Nuxt UI, Composition API y TypeScript. Sigue la regla de fechas de `AGENTS.md`.
- Al tocar una pantalla existente, migra los patrones equivalentes de la parte modificada. No hace falta migrar módulos ajenos al cambio.
