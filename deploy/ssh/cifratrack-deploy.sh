#!/usr/bin/env bash
# Instalar na VPS:
#   mkdir -p ~/.ssh
#   cp deploy/ssh/cifratrack-deploy.sh ~/.ssh/cifratrack-deploy.sh
#   chmod 700 ~/.ssh/cifratrack-deploy.sh
#   # opcional: export CIFRATRACK_ROOT=/opt/ciframusical
# Uso:
#   ~/.ssh/cifratrack-deploy.sh          # git pull + ./deploy.sh up
#   ~/.ssh/cifratrack-deploy.sh pull     # só git pull
#   ~/.ssh/cifratrack-deploy.sh up
#   ~/.ssh/cifratrack-deploy.sh rebuild
#   ~/.ssh/cifratrack-deploy.sh logs
set -euo pipefail

# Raiz do clone na VPS (ajuste se o repo estiver noutro path)
CIFRATRACK_ROOT="${CIFRATRACK_ROOT:-$HOME/ciframusical}"
if [[ ! -d "$CIFRATRACK_ROOT/.git" ]]; then
  # fallback comum
  for candidate in \
    "$HOME/cifrasmusicais" \
    "/opt/ciframusical" \
    "/var/www/ciframusical" \
    "/root/ciframusical" \
    "/root/cifrasmusicais"; do
    if [[ -d "$candidate/.git" ]]; then
      CIFRATRACK_ROOT="$candidate"
      break
    fi
  done
fi

if [[ ! -d "$CIFRATRACK_ROOT/.git" ]]; then
  echo "Clone não encontrado. Defina CIFRATRACK_ROOT=/caminho/do/repo" >&2
  exit 1
fi

DEPLOY_SH="$CIFRATRACK_ROOT/deploy/deploy.sh"
if [[ ! -x "$DEPLOY_SH" ]]; then
  chmod +x "$DEPLOY_SH" 2>/dev/null || true
fi

CMD="${1:-up}"

echo "→ repo: $CIFRATRACK_ROOT"
echo "→ cmd:  $CMD"

case "$CMD" in
  pull)
    git -C "$CIFRATRACK_ROOT" pull --ff-only
    ;;
  up|deploy|rebuild|down|logs|ps|status|migrate|seed)
    # deploy.sh já faz git pull em up/rebuild
    exec "$DEPLOY_SH" "$CMD"
    ;;
  *)
    echo "Uso: $0 {up|pull|rebuild|down|logs|ps|migrate|seed}" >&2
    exit 1
    ;;
esac
