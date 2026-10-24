#!/usr/bin/env bash
# Local PostgreSQL without Docker: Homebrew's postgresql@17 as a background service.
#   pnpm db:setup   # once: install (if missing), start, create the visualise role and database
#   pnpm db:start / pnpm db:stop
set -euo pipefail

PG=postgresql@17
BIN="$(brew --prefix)/opt/$PG/bin"

case "${1:-setup}" in
  setup)
    if ! brew list --formula | grep -q "^${PG}$"; then
      echo "installing $PG ..."; brew install "$PG"
    fi
    brew services start "$PG" >/dev/null
    for i in $(seq 1 30); do "$BIN/pg_isready" -q && break; sleep 1; done
    "$BIN/psql" postgres -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'visualise') then
    create role visualise login password 'visualise';
  end if;
end $$;
SQL
    if ! "$BIN/psql" postgres -tAc "select 1 from pg_database where datname = 'visualise'" | grep -q 1; then
      "$BIN/createdb" -O visualise visualise
    fi
    echo "postgres ready: postgresql://visualise:visualise@127.0.0.1:5432/visualise"
    ;;
  start) brew services start "$PG" ;;
  stop) brew services stop "$PG" ;;
  *) echo "usage: db-local.sh [setup|start|stop]"; exit 1 ;;
esac
