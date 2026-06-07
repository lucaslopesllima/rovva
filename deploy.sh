#!/usr/bin/env bash
# Deploy de PRODUÇÃO — rode na VPS, dentro do diretório do projeto.
# Builda a imagem multi-stage e (re)sobe a stack de produção (docker-compose.prod.yml).
# As migrations rodam no boot do app (idempotentes).
#
#   ./deploy.sh            # git pull (se for repo) + build + up -d + health + prune
#   SKIP_GIT=1 ./deploy.sh # não faz git pull
set -euo pipefail

cd "$(dirname "$0")"
COMPOSE=(docker compose -f docker-compose.prod.yml)

# --- segurança: produção exige um .env real (NÃO o dev) ---
if [ ! -f .env ]; then
  echo "ERRO: .env ausente. Rode: cp .env.example .env  e configure JWT_SECRET/POSTGRES_PASSWORD." >&2
  exit 1
fi
# carrega .env para checagens e para descobrir APP_PORT
set -a; . ./.env; set +a

: "${JWT_SECRET:?ERRO: defina JWT_SECRET no .env}"
: "${POSTGRES_PASSWORD:?ERRO: defina POSTGRES_PASSWORD no .env}"
case "${JWT_SECRET}" in
  ""|"change-this-to-a-long-random-secret"|"dev"|"dev-secret"|"integration-test-secret-please-change")
    echo "ERRO: JWT_SECRET inseguro. Gere um segredo forte (ex.: openssl rand -hex 32)." >&2
    exit 1 ;;
esac

PORT="${APP_PORT:-8080}"

# --- atualizar código (se for um checkout git) ---
if [ -d .git ] && [ "${SKIP_GIT:-0}" != "1" ]; then
  echo "==> git pull --ff-only"
  git pull --ff-only
fi

echo "==> build da imagem de produção"
"${COMPOSE[@]}" build

echo "==> subindo a stack (migrations rodam no boot)"
"${COMPOSE[@]}" up -d

echo "==> aguardando health em http://localhost:${PORT}/api/health"
ok=0
for _ in $(seq 1 45); do
  if curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
if [ "$ok" != "1" ]; then
  echo "ERRO: app não respondeu health a tempo. Logs:" >&2
  "${COMPOSE[@]}" logs --tail=40 app >&2
  exit 1
fi
echo "    healthy ✓"

echo "==> limpando imagens antigas"
docker image prune -f >/dev/null || true

"${COMPOSE[@]}" ps
echo "==> deploy concluído."
