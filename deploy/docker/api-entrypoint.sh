#!/bin/sh
set -e

PRISMA_BIN="./node_modules/.bin/prisma"
if [ ! -x "$PRISMA_BIN" ]; then
  PRISMA_BIN="../../node_modules/.bin/prisma"
fi

echo "[cifratrack-api] waiting for database..."
i=0
until "$PRISMA_BIN" migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[cifratrack-api] database not ready after retries" >&2
    exit 1
  fi
  echo "[cifratrack-api] migrate failed, retry $i/30..."
  sleep 2
done

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[cifratrack-api] running seed..."
  TSX_BIN="./node_modules/.bin/tsx"
  if [ ! -x "$TSX_BIN" ]; then
    TSX_BIN="../../node_modules/.bin/tsx"
  fi
  "$TSX_BIN" prisma/seed.ts || true
fi

echo "[cifratrack-api] starting..."
exec "$@"
