# Carolina Pinturas — panel Siigo

Panel interno construido desde la plantilla Nuxt UI Dashboard. Siigo México es la fuente única para el catálogo, clientes y documentos de venta: la aplicación no persiste una copia del CRM.

## Incluido en esta primera base

- Acceso con correo y contraseña para los tres roles: `admin`, `mostrador` y `vendedor`.
- Sesiones firmadas mediante cookie `HttpOnly`, sin exponer credenciales de Siigo al navegador.
- Navegación responsive para inicio, productos, clientes y ventas.
- Rutas de servidor protegidas para leer productos, clientes, facturas y recepciones de pago.
- Resumen y tablas sin datos simulados: cuando Siigo no está configurado, la interfaz muestra un estado de conexión explícito.
- Pantalla de configuración exclusiva para administradores.

## Configuración local

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Completa `.env` antes de iniciar. No subas este archivo ni copies secretos en el código.

### Usuarios de la aplicación

Genera un hash por contraseña:

```bash
pnpm auth:hash -- "una-contraseña-segura"
```

Configura los tres usuarios en `NUXT_APP_USERS` como JSON de una sola línea, envuelto entre comillas simples en `.env`:

```env
NUXT_APP_USERS='[{"name":"Administrador","email":"admin@ejemplo.mx","role":"admin","passwordHash":"scrypt$..."},{"name":"Mostrador","email":"mostrador@ejemplo.mx","role":"mostrador","passwordHash":"scrypt$..."},{"name":"Vendedor","email":"vendedor@ejemplo.mx","role":"vendedor","passwordHash":"scrypt$..."}]'
```

En Vercel, usa exactamente el mismo JSON como valor de `NUXT_APP_USERS`, sin saltos de línea. Como alternativa, puedes usar `NUXT_APP_USERS_BASE64` con el JSON codificado en base64url; este formato tiene prioridad y evita problemas de escapado.

Genera `NUXT_APP_SESSION_SECRET` con al menos 32 caracteres aleatorios:

```bash
openssl rand -base64 48
```

### Conexión Siigo

Configura estas variables únicamente en `.env` y en Vercel:

- `NUXT_SIIGO_API_URL`
- `NUXT_SIIGO_USERNAME`
- `NUXT_SIIGO_ACCESS_KEY`
- `NUXT_SIIGO_APPLICATION_ID` (por defecto `CarolinaPinturas`)

La aplicación usa el contrato de Siigo API México: `https://api.siigo.mx`, OAuth con `username` y `access_key`, y el encabezado `SiigoAPI-Application-Id`. Este último debe ser el nombre alfanumérico sin espacios que identifica la integración; `CarolinaPinturas` queda definido como valor inicial. El token se obtiene solo desde el servidor y se mantiene en memoria durante su vigencia. Nunca se expone la llave, el usuario ni el token al cliente.

> Antes de habilitar operaciones de escritura, usaremos primero las credenciales reales para validar lecturas y los tipos de documento configurados en la cuenta. Las facturas y cobros se seguirán protegiendo hasta completar esa comprobación.

## Permisos actuales

| Rol | Acceso previsto |
| --- | --- |
| Administrador | Configuración, consultas y futuras operaciones de catálogo/ventas. |
| Mostrador | Consulta de inventario/clientes y futuras cotizaciones, facturas y cobros. |
| Vendedor | Consulta de catálogo/clientes y futuras altas de clientes/cotizaciones. |

Las operaciones que creen, modifiquen o anulen documentos fiscales permanecen deshabilitadas hasta contar con el contrato validado y un entorno de prueba seguro.

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm build
```

La revisión visual de la adaptación está documentada en [`design-qa.md`](./design-qa.md).

## Despliegue en Vercel

1. Crea un repositorio privado y conecta el proyecto a Vercel.
2. Agrega todas las variables `NUXT_APP_*` y `NUXT_SIIGO_*` en Production y Preview; no uses valores de ejemplo.
3. Usa el dominio propio una vez que la primera vista previa haya validado el inicio de sesión.
4. Tras configurar Siigo, valida lecturas antes de activar cualquier ruta de escritura.
