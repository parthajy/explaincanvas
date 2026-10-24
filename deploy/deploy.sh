#!/usr/bin/env bash
# Build and (re)start on the Droplet. Run as root:  bash /srv/explaincanvas/deploy/deploy.sh
set -euo pipefail
cd /srv/explaincanvas
chown -R app:app /srv/explaincanvas
sudo -H -u app pnpm install --frozen-lockfile --prod=false
sudo -H -u app bash -c 'set -a; source .env.production; set +a; pnpm migrate'
sudo -H -u app bash -c 'export NODE_OPTIONS=--max-old-space-size=1536; pnpm build'
install -m 755 /srv/explaincanvas/deploy/backup.sh /usr/local/bin/explaincanvas-backup
{ crontab -l 2>/dev/null | grep -v explaincanvas-backup || true; echo "0 22 * * * /usr/local/bin/explaincanvas-backup >> /var/log/explaincanvas-backup.log 2>&1"; } | crontab -
systemctl restart explaincanvas-web explaincanvas-worker
sleep 3
systemctl --no-pager --lines=3 status explaincanvas-web explaincanvas-worker | grep -E "Active|explaincanvas-"
curl -s -m 20 http://127.0.0.1:3000/api/health; echo
