#!/usr/bin/env bash
# WolfTag deploy script
# Builds the frontend and syncs it to the nginx serve directory.
# Run from the project root: ./scripts/deploy.sh [serve-dir]
#
# Examples:
#   ./scripts/deploy.sh                        # deploys to /var/www/wolftag
#   ./scripts/deploy.sh /var/www/mydir        # custom serve directory
#   BACKEND_PORT=3001 ./scripts/deploy.sh     # use a different backend port

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
SERVE_DIR="${1:-/var/www/wolftag}"
BACKEND_PORT="${BACKEND_PORT:-3000}"

echo "==> Building frontend..."
cd "$FRONTEND_DIR"
npm ci --silent
VITE_API_BASE_URL="" npm run build

echo "==> Deploying to $SERVE_DIR..."
sudo mkdir -p "$SERVE_DIR"
sudo rsync -a --delete "$FRONTEND_DIR/dist/" "$SERVE_DIR/"

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
echo "  sudo ln -s /etc/nginx/sites-available/wolftag /etc/nginx/sites-enabled/"
echo "  sudo nginx -t && sudo systemctl reload nginx"
