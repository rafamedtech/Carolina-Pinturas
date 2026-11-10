# Revisión de egress — 09/11/2026

## Evidencia de producción

Revisión de solo lectura en el dashboard autenticado de Supabase:

- Organización `cvrtransportinc's Org`, plan Free: **9.776 GB / 5 GB** en el ciclo 01/11/2026–01/12/2026.
- Carolina Pinturas: **9.768 GB**; prácticamente todo el consumo de la organización. CVR aporta aproximadamente 0.008 GB por diferencia entre cifras redondeadas.
- Carolina muestra 2 usuarios activos, 0 mensajes Realtime, 0 invocaciones de Edge Functions y Storage redondeado a 0 GB. Estas cifras no atribuyen por sí solas todo el egress a PostgreSQL.
- Aviso de periodo de gracia hasta **08/12/2026**. El exceso ya consumido no desaparece al optimizar.
- Catálogo: **1,388 productos**, con **1,034,316 bytes** de JSON `raw_payload` en total.
- `pg_stat_statements`: la consulta completa de `getStoredProducts` acumulaba **3,439 llamadas / 4,187,046 filas**. Dos variantes del listado de inventario acumulaban **12,950 / 1,219,319** y **4,940 / 464,795** llamadas/filas.
- Las estadísticas se reiniciaron el **01/07/2026**; sus contadores NO equivalen al tráfico de noviembre, ni miden bytes de facturación.

## Cambios

1. `getStoredProducts` comparte una única carga del catálogo por cliente Prisma y proceso, incluyendo solicitudes concurrentes. Antes de cada uso consulta `COUNT(*)` y `MAX(updated_at)` para detectar escrituras de otras instancias. Caduca a los 60 segundos como respaldo, no conserva errores y entrega copias independientes. Los detalles y las lecturas por IDs usadas al guardar pedidos siguen consultando directamente la base.
2. `attachProductCompositions` selecciona únicamente disponibilidad, composición e inventario: evita descargar otra copia de todas las columnas y `raw_payload`. Las existencias y escrituras pendientes se siguen consultando en cada petición.
3. Los listados de productos y existencias del inventario seleccionan únicamente los campos que presentan, conservando costos, monedas, unidades, reservas, mínimos y versiones.

No se modificaron esquemas, RLS, permisos, credenciales, suscripción ni datos productivos. El catálogo que se reutiliza ya era común a los roles autorizados; la autenticación de las rutas permanece intacta. La lista pública de precios sigue exponiendo únicamente su proyección pública existente.

## Medición de tamaño

Sobre los mismos 1,388 productos en producción, comparar la representación JSON de las columnas del producto completo contra las necesarias para el listado de inventario dio **2,369,182 → 384,362 bytes**, una reducción de **83.8%**. Es una comparación de volumen lógico de columnas: no incluye relaciones, protocolo PostgreSQL ni otros servicios, y NO es una reducción medida del egress total facturado.

```sql
select count(*) as products,
       sum(octet_length(to_jsonb(p)::text)) as inventory_before_json_bytes,
       sum(octet_length(jsonb_build_object(
         'id', id, 'code', code, 'name', name, 'reference', reference,
         'barcode', barcode, 'unitName', unit_name, 'unitCode', unit_code,
         'unitCost', unit_cost, 'costCurrency', cost_currency,
         'initialUnitCost', initial_unit_cost,
         'initialCostCurrency', initial_cost_currency
       )::text)) as inventory_after_json_bytes,
       sum(octet_length(raw_payload::text)) as catalog_raw_bytes
from public.siigo_products p;
```

## Verificación y decisión de plan

- Pruebas de caché: carga concurrente, invalidación por cambios/eliminaciones, caducidad, recuperación de errores, aislamiento de copias y lecturas frescas por IDs.
- Pruebas de proyecciones: importes y monedas, unidades, disponibles/reservas, mínimos y composición sin `raw_payload` innecesario.
- Verificación en la sesión existente de Chrome de localhost: catálogo de productos y existencias.
- Los cambios necesitan desplegarse para reducir el tráfico de producción. La caché vive por proceso; las instancias nuevas descargan su primera copia y la eficacia real depende de la reutilización de instancias y la frecuencia de cambios.
- Revisar 48–72 horas de uso normal después del despliegue, con el filtro del proyecto y el desglose **Shared Pooler / Database / Auth / Storage**. El panel puede tardar una hora en actualizarse.
- Para caber en 5 GB durante un mes de 30 días, el promedio total de la organización debe quedar por debajo de aproximadamente **167 MB/día**, preferentemente con margen. Esto sirve para un ciclo completo: noviembre ya excedió el límite.
- Si el consumo optimizado sigue por encima o se necesita evitar el riesgo operativo al terminar la gracia, contratar Pro. No se puede garantizar permanecer en Free a partir de esta revisión del código.

Fuentes: [Egress y cuotas](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [precios](https://supabase.com/pricing), [estadísticas de consultas](https://supabase.com/docs/guides/database/extensions/pg_stat_statements).
