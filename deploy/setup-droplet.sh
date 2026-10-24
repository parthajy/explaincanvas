#!/usr/bin/env bash
# One-time setup on a fresh Ubuntu 24.04 Droplet. The code is rsynced to /srv/explaincanvas by deploy/push.sh.
# Run as root on the Droplet:  DOMAIN=explaincanvas.com bash /srv/explaincanvas/deploy/setup-droplet.sh
set -euo pipefail
: "${DOMAIN:?set DOMAIN}"
export DEBIAN_FRONTEND=noninteractive

apt-get update -q && apt-get install -y -q curl git ufw rsync debian-keyring debian-archive-keyring apt-transport-https postgresql postgresql-contrib

# Swap: next build needs more than 2 GB of RAM headroom on small Droplets.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Node 22 + pnpm
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null && apt-get install -y -q nodejs
fi
# pnpm as a real global install (a corepack shim symlinked onto itself breaks for other users)
corepack disable >/dev/null 2>&1 || true
rm -f /usr/bin/pnpm /usr/bin/pnpx /usr/local/bin/pnpm /usr/local/bin/pnpx
npm install -g --force pnpm@9.15.5 >/dev/null
ln -sf "$(npm root -g)/pnpm/bin/pnpm.cjs" /usr/bin/pnpm

# Caddy (automatic HTTPS)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi

# Firewall
ufw allow OpenSSH >/dev/null && ufw allow 80 >/dev/null && ufw allow 443 >/dev/null && ufw --force enable >/dev/null

# App user and directory
id -u app >/dev/null 2>&1 || useradd -m -s /bin/bash app
mkdir -p /srv/explaincanvas && chown -R app:app /srv/explaincanvas

# Local Postgres role + database (password comes from the env file's DATABASE_URL)
PGPASS=$(grep -E '^DATABASE_URL=' /srv/explaincanvas/.env.production | sed -E 's#.*//[^:]+:([^@]+)@.*#\1#')
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'explaincanvas') then
    create role explaincanvas login password '${PGPASS}';
  else
    alter role explaincanvas password '${PGPASS}';
  end if;
end \$\$;
SQL
sudo -u postgres psql -tAc "select 1 from pg_database where datname = 'explaincanvas'" | grep -q 1 || sudo -u postgres createdb -O explaincanvas explaincanvas

# Services
install -m 644 /srv/explaincanvas/deploy/explaincanvas-web.service /etc/systemd/system/
install -m 644 /srv/explaincanvas/deploy/explaincanvas-worker.service /etc/systemd/system/
install -m 644 /srv/explaincanvas/deploy/Caddyfile /etc/caddy/Caddyfile
echo "DOMAIN=$DOMAIN" > /etc/caddy/env
mkdir -p /etc/systemd/system/caddy.service.d && printf '[Service]\nEnvironmentFile=/etc/caddy/env\n' > /etc/systemd/system/caddy.service.d/env.conf
systemctl daemon-reload
systemctl enable caddy explaincanvas-web explaincanvas-worker >/dev/null
systemctl restart caddy
# Nightly database backup to Spaces (03:30 IST = 22:00 UTC)
install -m 755 /srv/explaincanvas/deploy/backup.sh /usr/local/bin/explaincanvas-backup
{ crontab -l 2>/dev/null | grep -v explaincanvas-backup || true; echo "0 22 * * * /usr/local/bin/explaincanvas-backup >> /var/log/explaincanvas-backup.log 2>&1"; } | crontab -
echo "setup complete"
