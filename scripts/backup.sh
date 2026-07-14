#!/usr/bin/env bash
# Vuelca Postgres y sube el dump a un bucket R2/S3 DEDICADO a backups (distinto
# del bucket de uploads de la app: BACKUP_S3_* separados de S3_*). Pensado
# para correr en el VPS vía cron diario y antes de cada deploy. Uso:
#   ./scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
[ -f .env ] && source .env
set +a

: "${POSTGRES_USER:=nab}"
: "${POSTGRES_DB:=nab}"
: "${BACKUP_DIR:=/opt/nab/backups}"
: "${BACKUP_S3_BUCKET:?Falta BACKUP_S3_BUCKET (bucket R2 dedicado a backups)}"
: "${BACKUP_S3_ENDPOINT:?Falta BACKUP_S3_ENDPOINT}"
: "${BACKUP_S3_ACCESS_KEY:?Falta BACKUP_S3_ACCESS_KEY}"
: "${BACKUP_S3_SECRET_KEY:?Falta BACKUP_S3_SECRET_KEY}"

command -v aws >/dev/null 2>&1 || { echo "Falta awscli. Instálalo: apt-get install -y awscli"; exit 1; }

mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%d-%H%M%S)
FILE="nab-${STAMP}.dump"
LOCAL_PATH="${BACKUP_DIR}/${FILE}"

echo "==> Volcando Postgres (${POSTGRES_DB}) a ${LOCAL_PATH}"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" >"$LOCAL_PATH"

# Un dump vacío (por un fallo silencioso de pg_dump/el contenedor) no debe
# subirse como si fuera un backup válido — daría una falsa sensación de
# seguridad hasta el día que haga falta restaurar.
if [ ! -s "$LOCAL_PATH" ]; then
  echo "✖ El dump quedó vacío (${LOCAL_PATH}); no se sube. Revisa el contenedor de postgres." >&2
  rm -f "$LOCAL_PATH"
  exit 1
fi

echo "==> Subiendo a s3://${BACKUP_S3_BUCKET}/postgres/${FILE}"
AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
  aws s3 cp "$LOCAL_PATH" "s3://${BACKUP_S3_BUCKET}/postgres/${FILE}" --endpoint-url "$BACKUP_S3_ENDPOINT"

# La retención a largo plazo la hace una regla de lifecycle en el bucket R2
# (configúrala una vez en el dashboard de Cloudflare: expira objetos con
# prefix "postgres/" después de, p.ej., 30 días). Local solo guardamos 2 días
# para poder restaurar rápido sin depender de la red.
find "$BACKUP_DIR" -name 'nab-*.dump' -mtime +2 -delete

echo "==> Backup completo: ${FILE}"
