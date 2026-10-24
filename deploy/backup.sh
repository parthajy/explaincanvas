#!/usr/bin/env bash
# Nightly Postgres dump to Spaces. Installed by setup-droplet.sh as a cron job (03:30 IST).
set -euo pipefail
cd /srv/explaincanvas
set -a; source .env.production; set +a
STAMP=$(date -u +%Y-%m-%dT%H%M)
FILE=/tmp/explaincanvas-$STAMP.sql.gz
sudo -u postgres pg_dump explaincanvas | gzip -9 > "$FILE"
node - "$FILE" "$STAMP" <<'JS'
const { S3Client, PutObjectCommand } = require("/srv/explaincanvas/node_modules/@aws-sdk/client-s3");
const fs = require("fs");
const [file, stamp] = process.argv.slice(2);
const c = new S3Client({ region: "us-east-1", endpoint: `https://${process.env.SPACES_REGION}.digitaloceanspaces.com`, credentials: { accessKeyId: process.env.SPACES_KEY, secretAccessKey: process.env.SPACES_SECRET } });
c.send(new PutObjectCommand({ Bucket: process.env.SPACES_BUCKET, Key: `backups/db/${stamp}.sql.gz`, Body: fs.readFileSync(file), ContentType: "application/gzip" }))
  .then(() => console.log(`backup uploaded: backups/db/${stamp}.sql.gz (${fs.statSync(file).size} bytes)`))
  .catch((e) => { console.error("backup upload failed", e.message); process.exit(1); });
JS
rm -f "$FILE"
