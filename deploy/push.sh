#!/usr/bin/env bash
# From your Mac: sync this folder to the Droplet and deploy.
#   bash deploy/push.sh            # sync + deploy
#   SETUP=1 bash deploy/push.sh    # first time: also run setup-droplet.sh
set -euo pipefail
HOST=${HOST:-root@159.89.171.171}
DOMAIN=${DOMAIN:-explaincanvas.com}
DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE=${ENV_FILE:-$DIR/.env.production}
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE (see deploy/README.md)"; exit 1; }

ssh "$HOST" 'mkdir -p /srv/explaincanvas'
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .data --exclude .git --exclude '.env*' --exclude tsconfig.tsbuildinfo \
  "$DIR"/ "$HOST":/srv/explaincanvas/
scp -q "$ENV_FILE" "$HOST":/srv/explaincanvas/.env.production
ssh "$HOST" 'chmod 600 /srv/explaincanvas/.env.production'
if [ "${SETUP:-0}" = "1" ]; then ssh "$HOST" "DOMAIN=$DOMAIN bash /srv/explaincanvas/deploy/setup-droplet.sh"; fi
ssh "$HOST" 'bash /srv/explaincanvas/deploy/deploy.sh'
