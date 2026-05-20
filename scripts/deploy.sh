#!/usr/bin/env bash
# WolfTag deploy script
# Builds the frontend via Docker (no npm required on host) and syncs it to
# the nginx serve directory, then starts the backend container.
#
# Run from the project root: ./scripts/deploy.sh [serve-dir]
#
# Examples:
#   ./scripts/deploy.sh /srv/wolftag/dist    # typical server deploy
#   ./scripts/deploy.sh                      # falls back to /var/www/wolftag
#   BACKEND_PORT=3001 ./scripts/deploy.sh /srv/wolftag/dist

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
SERVE_DIR="${1:-/var/www/wolftag}"
BACKEND_PORT="${BACKEND_PORT:-3000}"

echo "==> Building frontend (Docker)..."
docker build --target builder -t wolftag-frontend-builder "$FRONTEND_DIR"

echo "==> Deploying to $SERVE_DIR..."
mkdir -p "$SERVE_DIR"
TMP_CONTAINER=$(docker create wolftag-frontend-builder)
docker cp "$TMP_CONTAINER:/app/dist/." "$SERVE_DIR/"
docker rm "$TMP_CONTAINER" > /dev/null

echo "==> Starting backend container..."
cd "$PROJECT_ROOT"
BACKEND_PORT="$BACKEND_PORT" docker compose up -d --build

echo ""
echo "Done."
echo "  Frontend: $SERVE_DIR  (served by host nginx)"
echo "  Backend:  127.0.0.1:$BACKEND_PORT  (Docker container)"
echo ""
echo "If this is your first deploy, set up nginx:"
echo "  sudo cp $PROJECT_ROOT/nginx.wolftag.conf /etc/nginx/sites-available/wolftag"
echo "  sudo ln -s /etc/nginx/sites-available/wolftag /etc/nginx/sites-enabled/wolftag"
echo "  sudo nginx -t && sudo systemctl reload nginx"
