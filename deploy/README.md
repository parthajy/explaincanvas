# Deploying ExplainCanvas to a DigitalOcean Droplet

For a Droplet (your A record points at 159.89.171.171). App Platform users should use `.do/app.yaml` instead.

## What runs where

| Piece | Where |
| --- | --- |
| Web (Next.js on port 3000) and the worker | the Droplet, as two systemd services under the `app` user |
| HTTPS, certificates, reverse proxy | Caddy on the Droplet, automatic Let's Encrypt |
| Database | DigitalOcean Managed PostgreSQL (recommended), or `apt install postgresql` on the Droplet to start cheap |
| Uploads and generated media | DigitalOcean Spaces |

## How it is deployed today (explaincanvas.com)

No GitHub in the loop: `deploy/push.sh` rsyncs this folder from your Mac to `/srv/explaincanvas` on the Droplet, copies `.env.production`, and runs `deploy/deploy.sh` there (install, migrate, build, restart).

- `.env.production` lives next to `.env.local` on your Mac (git-ignored). It is `.env.local` with `APP_URL=https://explaincanvas.com`, the Droplet's local Postgres URL, `RUN_PIPELINE_INLINE=false` and `NODE_ENV=production`.
- Postgres runs on the Droplet (role and database `explaincanvas`, password inside `DATABASE_URL`). Move to Managed Postgres before scale.

## First time on a fresh Droplet

```bash
SETUP=1 bash deploy/push.sh      # installs Node, pnpm, Caddy, Postgres, swap, firewall, services; then deploys
```

## Every deploy after that

```bash
bash deploy/push.sh              # from the repo folder on your Mac
```

Changed only the env file? `scp .env.production root@159.89.171.171:/srv/explaincanvas/ && ssh root@159.89.171.171 systemctl restart explaincanvas-web explaincanvas-worker`.

## Useful commands

```bash
journalctl -u explaincanvas-web -f        # web logs (JSON)
journalctl -u explaincanvas-worker -f     # worker logs
systemctl restart explaincanvas-web
caddy validate --config /etc/caddy/Caddyfile
```

## Database on the Droplet (if not using Managed Postgres)

```bash
apt install -y postgresql
sudo -u postgres psql -c "create role explaincanvas login password 'CHANGE_ME';"
sudo -u postgres createdb -O explaincanvas explaincanvas
# DATABASE_URL=postgresql://explaincanvas:CHANGE_ME@127.0.0.1:5432/explaincanvas  (DATABASE_SSL=off)
```
Back it up nightly (`pg_dump`) to Spaces before taking paying customers; Managed Postgres does this for you.
