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
2. **API:** disponible en la etapa 3.
3. **Panel de administración:** disponible en la etapa 6.
4. **Landing:** disponible en la etapa 7.

## Etapas

El orden está en `docs/05-plan-de-construccion.md`. Cada etapa es una rama y un commit.
