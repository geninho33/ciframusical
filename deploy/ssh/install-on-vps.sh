#!/usr/bin/env bash
# Rode UMA vez na VPS, a partir do clone:
#   bash deploy/ssh/install-on-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/deploy/ssh/cifratrack-deploy.sh"
DEST="${HOME}/.ssh/cifratrack-deploy.sh"

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"
cp "$SRC" "$DEST"
chmod 700 "$DEST"

# Grava o root do repo para o wrapper achar o clone
MARKER="${HOME}/.ssh/cifratrack-root"
echo "$ROOT" > "$MARKER"
chmod 600 "$MARKER"

# Garante que o wrapper use este path
if ! grep -q 'CIFRATRACK_ROOT' "$DEST" 2>/dev/null; then
  true
fi
# Reescreve default no script instalado via env file
ENV_FILE="${HOME}/.ssh/cifratrack.env"
cat > "$ENV_FILE" <<EOF
export CIFRATRACK_ROOT="$ROOT"
EOF
chmod 600 "$ENV_FILE"

# Prefixo no script instalado para carregar o env
TMP="$(mktemp)"
{
  echo '#!/usr/bin/env bash'
  echo "set -euo pipefail"
  echo "[[ -f \"\$HOME/.ssh/cifratrack.env\" ]] && source \"\$HOME/.ssh/cifratrack.env\""
  # corpo original sem o shebang
  tail -n +2 "$SRC"
} > "$TMP"
mv "$TMP" "$DEST"
chmod 700 "$DEST"

echo "OK: instalado em $DEST"
echo "    CIFRATRACK_ROOT=$ROOT"
echo
echo "Uso:"
echo "  ~/.ssh/cifratrack-deploy.sh up"
echo "  ~/.ssh/cifratrack-deploy.sh pull"
