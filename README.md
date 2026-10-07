# Morazul

Sistema de inventario y landing para Morazul, emprendimiento de lociones y perfumes de Juan Camilo Mora Castañeda. Producto único para Computación al Servidor e Ingeniería Orientada a Objetos (Universidad Surcolombiana), para presentar en INNOVASOFT IX el 19 de noviembre de 2026.

## Estructura

| Carpeta | Contenido |
|---|---|
| `api/` | API REST en Node.js + Express |
| `admin/` | Panel de administración (React) |
| `landing/` | Landing pública (React) |
| `db/` | Modelo relacional v1 y migraciones numeradas en `db/migrations/` |
| `data/` | Catálogo de 125 fragancias (`fragancias.json` y `.csv`) |
| `assets/` | Logos e imágenes exportados de Figma |
| `docs/` | Contexto, arquitectura, datos, diseño y plan de construcción |

Cada pieza se despliega por separado.

## Requisitos

- Node.js 22 o superior, con npm
- PostgreSQL 16
- Git

Los proyectos de React usan Vite.

## Configuración

Copiar `.env.example` a `.env` en cada pieza que lo necesite y completar los valores. El `.env` no se sube a Git.

## Cómo levantar todo

Los comandos se completan a medida que avanzan las etapas.

1. **Base de datos** (PostgreSQL 16; en esta máquina corre en el puerto 5433 porque la 18 ocupa el 5432):
   - Crear el usuario y la base una sola vez, con `psql` como `postgres`: `CREATE ROLE morazul LOGIN PASSWORD '...'` y `CREATE DATABASE morazul OWNER morazul`.
   - Copiar `.env.example` a `.env` y completar `DB_USER`, `DB_PASSWORD` y `DB_PORT`.
   - Construir la base desde cero y probarla: `bash db/reconstruir.sh --probar`. Si `psql` no está en el PATH, anteponer `PSQL="ruta/a/psql"`.
   - El script aplica el modelo v1 y las migraciones de `db/migrations/` en orden. La 003 se genera con `node db/scripts/generar_carga_catalogo.js`.
2. **API** (desde la carpeta `api/`):
   - Instalar dependencias: `npm install`.
   - En el `.env` de la raíz, completar `JWT_SECRET` (mínimo 32 caracteres). Para generar uno: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   - Crear el primer administrador (pide los datos por consola; la contraseña no se muestra): `npm run crear-admin`.
   - Levantarla: `npm start` (o `npm run dev` para reiniciar al guardar). Escucha en el puerto 3000; la comprobación es `GET /api/salud`.
   - Pruebas: `npm test`. Usan una base aparte, `morazul_test`, que reconstruyen desde cero: crearla una vez con `CREATE DATABASE morazul_test OWNER morazul`. Nunca tocan `morazul`.
   - Rutas públicas bajo `/api/publico` (catálogo, categorías, contacto) y rutas protegidas con JWT (`Authorization: Bearer <token>`) bajo `/api/fragancias`, `/api/productos`, `/api/categorias`, `/api/configuracion`, `/api/inventario`, `/api/caja`, `/api/ventas`, `/api/alertas` y `/api/reportes`. El inicio de sesión es `POST /api/auth/login`.
   - Para vender hay que abrir la caja del día (`POST /api/caja/abrir`) y que el producto esté activo y con stock. Las entradas y ajustes de inventario van en `POST /api/inventario/movimientos`.
   - Reportes (`/api/reportes`): `mas-vendidos`, `menos-vendidos` (productos con stock que no rotan), `ventas` (totales y serie diaria) y `caja` (resumen por día con la diferencia del cierre). Reciben `desde` y `hasta` (AAAA-MM-DD, por defecto los últimos 30 días, máximo 366).
   - `db/reconstruir.sh` borra y reconstruye la base: se niega si ya tiene datos de trabajo (usuarios, ventas, movimientos o cajas). Para forzarlo, `FORZAR=si`.
   - Las fotos subidas se guardan en `api/uploads/` (fuera de Git); las imágenes genéricas van en `api/uploads/genericas/`: `generica-30ml.webp` (la que se muestra a todas las fragancias sin foto propia) y `reserva.webp` (respaldo).
3. **Panel de administración** (desde la carpeta `admin/`):
   - Instalar dependencias: `npm install`.
   - Con la API en marcha, levantarlo: `npm run dev` (abre en http://localhost:5173). Lee `VITE_API_URL` del `.env` de la raíz (por defecto http://localhost:3000).
   - Iniciar sesión con el administrador creado con `npm run crear-admin` en `api/`.
   - Pruebas: `npm test`. Compilar para producción: `npm run build` (queda en `admin/dist/`).
   - Se ve en celular y en escritorio; en celular el menú inferior tiene Inicio, Productos, Vender, Caja y Alertas, y el resto está en el menú lateral.
4. **Landing pública** (desde la carpeta `landing/`):
   - Instalar dependencias: `npm install`.
   - Con la API en marcha: `npm run dev` (abre en http://localhost:5174). Lee `VITE_API_URL` del `.env` de la raíz (por defecto http://localhost:3000), igual que el panel.
   - Páginas: Inicio, Catálogo (filtros por categoría y árabes, búsqueda y paginación), Detalle de cada fragancia y Contacto. No hay compra en línea: los pedidos se hacen con botones que abren WhatsApp con el mensaje ya escrito.
   - El teléfono, el correo y la ciudad salen de la API (`CONTACTO_*` en el `.env`); el horario y la dirección aparecen en Contacto en cuanto se definan.
   - Si una imagen no existe (por ejemplo, mientras no se suban las fotos genéricas), se muestra una ilustración neutra de Morazul.
   - Pruebas: `npm test`. Compilar para producción: `npm run build` (queda en `landing/dist/`).

## Etapas

El orden está en `docs/05-plan-de-construccion.md`. Cada etapa es una rama y un commit.
