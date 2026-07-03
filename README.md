# Carolina Pinturas — panel Siigo

Panel interno construido con Nuxt UI. Siigo México sigue siendo la fuente de
productos y clientes, mientras que los pedidos internos y sus snapshots
históricos se guardan en PostgreSQL/Supabase mediante Prisma.

## Incluido en esta primera base

- Acceso con Supabase Auth para los tres roles: `admin`, `mostrador` y `vendedor`.
- Sesiones SSR renovables mediante cookies, sin exponer credenciales de Siigo al navegador.
- Navegación responsive para inicio, productos, clientes y ventas.
- Rutas de servidor protegidas para leer productos y clientes directamente de Siigo.
- Pedidos internos persistidos en PostgreSQL con partidas, totales e historial de estados.
- Snapshot completo del cliente y de cada producto usado en el pedido, incluyendo el payload JSON original de Siigo.
- Resumen y tablas sin datos simulados: cuando Siigo no está configurado, la interfaz muestra un estado de conexión explícito.
- Pantalla de configuración exclusiva para administradores.

## Configuración local

```bash
cp .env.example .env
pnpm install
pnpm db:start
pnpm dev
```

Completa `.env` antes de iniciar. No subas este archivo ni copies secretos en el código.

### Base de datos local

La instancia local de Supabase usa puertos `55320`–`55329` para no interferir
con otros proyectos Supabase que utilicen los puertos predeterminados.

```bash
pnpm db:start
pnpm db:reset
pnpm db:generate
```

Las migraciones viven en `supabase/migrations` y son la fuente de verdad del
esquema SQL. `prisma/schema.prisma` define el modelo usado por la aplicación.
No uses `prisma migrate dev` en este proyecto; crea las migraciones con
`supabase migration new <nombre>` y comprueba que ambos esquemas coincidan:

```bash
pnpm db:validate
pnpm db:drift
pnpm db:lint
```

Supabase Studio queda disponible en `http://127.0.0.1:55323`.

### Usuarios de la aplicación

La autenticación usa Supabase Auth con correo y contraseña. El registro público
permanece deshabilitado: crea usuarios desde Authentication > Users en Supabase.
Cada usuario genera un registro en `public.app_users` con rol `vendedor`; ajusta
su nombre, rol (`admin`, `mostrador` o `vendedor`) y estado desde Table Editor.

Configura estas variables públicas localmente y en Vercel:

```env
NUXT_PUBLIC_SITE_URL=http://localhost:3000
NUXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La publishable key puede usarse en el navegador. Nunca configures una llave
`sb_secret_` o `service_role` como variable `NUXT_PUBLIC_*`.

Para recuperación de contraseña en producción configura un servidor SMTP en
Authentication > Email. El servicio de correo predeterminado de Supabase es
únicamente para pruebas y tiene restricciones de destinatarios y frecuencia.

En Authentication > URL Configuration usa la URL pública como Site URL y
autoriza `/auth/callback`, `http://localhost:3000/**` y las URLs de Preview que
se vayan a probar.

### Conexión Siigo

Configura estas variables únicamente en `.env` y en Vercel:

- `NUXT_SIIGO_API_URL`
- `NUXT_SIIGO_USERNAME`
- `NUXT_SIIGO_ACCESS_KEY`
- `NUXT_SIIGO_APPLICATION_ID` (por defecto `CarolinaPinturas`)

La aplicación usa el contrato de Siigo API México: `https://api.siigo.mx`, OAuth con `username` y `access_key`, y el encabezado `SiigoAPI-Application-Id`. Este último debe ser el nombre alfanumérico sin espacios que identifica la integración; `CarolinaPinturas` queda definido como valor inicial. El token se obtiene solo desde el servidor y se mantiene en memoria durante su vigencia. Nunca se expone la llave, el usuario ni el token al cliente.

Siigo México no expone un recurso de pedidos. Crear o cambiar un pedido solo
modifica PostgreSQL; no crea facturas, notas de venta ni remisiones en Siigo.
Al guardar un pedido, el servidor vuelve a consultar el cliente y cada producto
seleccionado para no confiar en datos enviados por el navegador.

### Modelo de pedidos

- Estados iniciales: borrador, ingresado, confirmado, surtido, en espera, en
  camino, entregado, facturado y cancelado.
- Cada cambio de estado registra fecha, usuario, rol y una nota opcional.
- `siigo_products` conserva las columnas consultables del producto; sus precios,
  impuestos, almacenes y componentes se normalizan en tablas relacionadas.
- `raw_payload` conserva íntegra la respuesta de Siigo para tolerar campos
  futuros sin perder datos.
- Las partidas guardan además código, nombre, unidad, precio, impuestos y el
  payload del producto tal como existían al crear el pedido.

## Permisos actuales

| Rol | Acceso previsto |
| --- | --- |
| Administrador | Configuración, consultas y futuras operaciones de catálogo/ventas. |
| Mostrador | Consulta de inventario/clientes y futuras cotizaciones, facturas y cobros. |
| Vendedor | Consulta de catálogo/clientes y futuras altas de clientes/cotizaciones. |

Las operaciones que creen, modifiquen o anulen documentos fiscales permanecen deshabilitadas hasta contar con el contrato validado y un entorno de prueba seguro.

## Verificación

```bash
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm build
```

La revisión visual de la adaptación está documentada en [`design-qa.md`](./design-qa.md).

## Despliegue en Vercel

1. Vincula la carpeta local con el proyecto de Supabase y aplica las migraciones:

   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

2. En Vercel configura `NUXT_PUBLIC_SITE_URL`, las dos variables
   `NUXT_PUBLIC_SUPABASE_*`, todas las `NUXT_SIIGO_*`, `DATABASE_URL` y
   `DIRECT_URL`.
3. Usa en `DATABASE_URL` la conexión Transaction Pooler de Supabase (puerto
   `6543`). Usa en `DIRECT_URL` la conexión directa o Session Pooler (puerto
   `5432`) para comandos de esquema.
4. No expongas ninguna URL de PostgreSQL como variable `NUXT_PUBLIC_*`.
5. Usa el dominio propio una vez que la vista previa haya validado el inicio de
   sesión, la creación de pedidos y los cambios de estado.
