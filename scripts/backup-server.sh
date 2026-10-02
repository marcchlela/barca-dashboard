#!/usr/bin/env bash

set -euo pipefail

ROOT="/srv/barca-dashboard"
BACKUP_DIR="$ROOT/backups"
ENV_FILE="$ROOT/.env.production"
COMPOSE_FILE="$ROOT/app/docker-compose.prod.yml"

mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/barca-dashboard-predeploy-$STAMP.dump"

echo "[backup] creating $TARGET"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T db \
  sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$TARGET"

echo "[backup] completed"