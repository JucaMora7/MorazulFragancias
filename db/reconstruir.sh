#!/usr/bin/env bash
# Borra y reconstruye la base de datos desde cero: modelo v1 + migraciones.
# Uso: bash db/reconstruir.sh [--probar]
# Lee las variables DB_* del archivo .env de la raíz del proyecto.
# Si psql no está en el PATH, definir PSQL con la ruta completa.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$raiz/.env" ]; then
  set -a; . "$raiz/.env"; set +a
else
  echo "Falta el archivo .env en la raíz (copiar .env.example y completarlo)." >&2
  exit 1
fi

: "${DB_NAME:?Falta DB_NAME en .env}" "${DB_USER:?Falta DB_USER en .env}" "${DB_PASSWORD:?Falta DB_PASSWORD en .env}"
export PGPASSWORD="$DB_PASSWORD"
psql_bin="${PSQL:-psql}"
base=(--host "${DB_HOST:-localhost}" --port "${DB_PORT:-5432}" --username "$DB_USER" --dbname "$DB_NAME" --no-psqlrc -v ON_ERROR_STOP=1 -q)

version=$("$psql_bin" "${base[@]}" -At -c "SHOW server_version_num")
if [ "${version:0:2}" != "16" ]; then
  echo "El servidor es la versión $version y el proyecto exige PostgreSQL 16. Revisa DB_PORT en .env." >&2
  exit 1
fi

echo "Reconstruyendo $DB_NAME en el puerto ${DB_PORT:-5432}..."
PGOPTIONS="-c client_min_messages=warning" "$psql_bin" "${base[@]}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
echo "  modelo v1"
"$psql_bin" "${base[@]}" -f "$raiz/db/morazul_modelo_relacional_v1.sql"
for m in "$raiz"/db/migrations/[0-9][0-9][0-9]_*.sql; do
  echo "  $(basename "$m")"
  "$psql_bin" "${base[@]}" -f "$m"
done

if [ "${1:-}" = "--probar" ]; then
  echo "Ejecutando pruebas..."
  "$psql_bin" "${base[@]}" -f "$raiz/db/tests/probar_base.sql"
fi
echo "Listo."
