#!/usr/bin/env bash
# Despliega la última imagen publicada en GHCR al VPS. Pensado para correr
# EN el VPS, dentro de /opt/nab (mismo directorio que docker-compose.prod.yml
# y .env). Uso:
#   ./scripts/deploy.sh                # despliega la tag "latest"
#   GHCR_IMAGE_TAG=sha-abc123 ./scripts/deploy.sh   # despliega una tag concreta (rollback)
set -euo pipefail
cd "$(dirname "$0")/.."

export GHCR_IMAGE_TAG="${GHCR_IMAGE_TAG:-latest}"
echo "==> Desplegando tag: ${GHCR_IMAGE_TAG}"

echo "==> Backup previo de Postgres"
./scripts/backup.sh || echo "AVISO: el backup falló, continuando de todos modos"

echo "==> Descargando imágenes"
docker compose -f docker-compose.prod.yml pull

echo "==> Aplicando migraciones"
docker compose -f docker-compose.prod.yml run --rm migrate

echo "==> Reiniciando servicios"
docker compose -f docker-compose.prod.yml up -d

echo "==> Limpiando imágenes viejas"
docker image prune -f

echo "==> Listo. Verificando /health..."
sleep 3
# El puerto de la API no está publicado al host (solo Caddy lo está), así que
# se verifica desde dentro de la red de compose.
docker compose -f docker-compose.prod.yml exec -T api wget -qO- http://127.0.0.1:4000/health \
  && echo " OK" || echo "AVISO: /health no respondió — revisa 'docker compose -f docker-compose.prod.yml logs api'"
