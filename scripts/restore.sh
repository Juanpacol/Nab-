#!/usr/bin/env bash
# Restaura un dump de Postgres. Pide confirmación explícita porque SOBRESCRIBE
# la base de datos actual. Uso:
#   ./scripts/restore.sh nab-20260713-030740.dump   # restaura un dump local (en $BACKUP_DIR)
#   ./scripts/restore.sh --latest                    # descarga y restaura el más reciente de R2
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
[ -f .env ] && source .env
set +a

: "${POSTGRES_USER:=nab}"
: "${POSTGRES_DB:=nab}"
: "${BACKUP_DIR:=/opt/nab/backups}"

TARGET="${1:?Uso: ./scripts/restore.sh <archivo.dump>|--latest}"

if [ "$TARGET" = "--latest" ]; then
  : "${BACKUP_S3_BUCKET:?Falta BACKUP_S3_BUCKET}"
  : "${BACKUP_S3_ENDPOINT:?Falta BACKUP_S3_ENDPOINT}"
  : "${BACKUP_S3_ACCESS_KEY:?Falta BACKUP_S3_ACCESS_KEY}"
  : "${BACKUP_S3_SECRET_KEY:?Falta BACKUP_S3_SECRET_KEY}"
  command -v aws >/dev/null 2>&1 || { echo "Falta awscli. Instálalo: apt-get install -y awscli"; exit 1; }

  LATEST_KEY=$(AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
    aws s3 ls "s3://${BACKUP_S3_BUCKET}/postgres/" --endpoint-url "$BACKUP_S3_ENDPOINT" \
    | sort | tail -n1 | awk '{print $4}')
  [ -n "$LATEST_KEY" ] || { echo "No se encontraron backups en s3://${BACKUP_S3_BUCKET}/postgres/"; exit 1; }

  mkdir -p "$BACKUP_DIR"
  TARGET="${BACKUP_DIR}/${LATEST_KEY}"
  echo "==> Descargando ${LATEST_KEY}"
  AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
    aws s3 cp "s3://${BACKUP_S3_BUCKET}/postgres/${LATEST_KEY}" "$TARGET" --endpoint-url "$BACKUP_S3_ENDPOINT"
elif [[ "$TARGET" != /* ]]; then
  TARGET="${BACKUP_DIR}/${TARGET}"
fi

[ -f "$TARGET" ] || { echo "No existe: $TARGET"; exit 1; }

echo "!!! Esto SOBRESCRIBE la base '${POSTGRES_DB}' con el contenido de: ${TARGET}"
read -r -p "Escribe 'restaurar' para continuar: " CONFIRM
[ "$CONFIRM" = "restaurar" ] || { echo "Cancelado."; exit 1; }

echo "==> Restaurando..."
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists <"$TARGET"

echo "==> Verificando conteos de tablas clave..."
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
SELECT 'User' AS tabla, count(*) FROM "User"
UNION ALL SELECT 'Job', count(*) FROM "Job"
UNION ALL SELECT 'Application', count(*) FROM "Application";
SQL

echo "==> Restore completo."
