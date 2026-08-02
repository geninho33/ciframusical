#!/usr/bin/env bash
# Deploy CifraTrack (web + api + postgres) a partir de /deploy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
ENV_FILE="$DEPLOY_DIR/.env"

cd "$ROOT"

pull_latest() {
  if [[ "${SKIP_GIT_PULL:-false}" == "true" ]]; then
    echo "→ SKIP_GIT_PULL=true — pulando git pull"
    return 0
  fi
  if [[ ! -d "$ROOT/.git" ]]; then
    echo "→ Aviso: $ROOT não é um clone git — pulando git pull" >&2
    return 0
  fi
  echo "→ git pull (origin)…"
  git -C "$ROOT" pull --ff-only
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "→ Criando $ENV_FILE a partir de .env.example"
  cp "$DEPLOY_DIR/.env.example" "$ENV_FILE"
  echo "  Edite $ENV_FILE (senhas/JWT/CORS) e rode de novo."
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

WEB_HOST_PORT="${WEB_HOST_PORT:-8088}"
API_HOST_PORT="${API_HOST_PORT:-3200}"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5434}"
MINIO_API_HOST_PORT="${MINIO_API_HOST_PORT:-9002}"

echo "=== CifraTrack deploy ==="
echo "  web   → host :$WEB_HOST_PORT"
echo "  api   → host :$API_HOST_PORT"
echo "  db    → host :$POSTGRES_HOST_PORT"
echo "  minio → host :$MINIO_API_HOST_PORT"
echo

CMD="${1:-up}"

case "$CMD" in
  up|deploy)
    pull_latest
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --pull
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
    echo
    echo "OK. Frontend: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$WEB_HOST_PORT"
    echo "    Health:   http://127.0.0.1:$API_HOST_PORT/v1/health"
    echo "    MinIO:    http://127.0.0.1:$MINIO_API_HOST_PORT (console :${MINIO_CONSOLE_HOST_PORT:-9003})"
    echo "Se api unhealthy: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs api --tail=200"
    ;;
  down)
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down
    ;;
  logs)
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs -f --tail=200
    ;;
  ps|status)
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
    ;;
  rebuild)
    pull_latest
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --no-cache --pull
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
    ;;
  pull)
    pull_latest
    ;;
  migrate)
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec api \
      sh -c './node_modules/.bin/prisma migrate deploy || ../../node_modules/.bin/prisma migrate deploy'
    ;;
  seed)
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec api \
      sh -c './node_modules/.bin/tsx prisma/seed.ts || ../../node_modules/.bin/tsx prisma/seed.ts'
    ;;
  *)
    echo "Uso: $0 {up|down|logs|ps|rebuild|pull|migrate|seed}"
    exit 1
    ;;
esac
