#!/usr/bin/env bash
# =========================================================
# Apply db/migrations/*.sql, in order, exactly once.
#
#   ./scripts/migrate.sh          # apply what is pending
#   ./scripts/migrate.sh --status # show applied / pending
#
# Why this exists: `db/init.sql` only runs on the FIRST start
# of an empty MySQL data volume. A deployed database that
# already has data never sees a schema change added there, so
# the change has to be applied as a migration — and a
# migration needs a ledger, or the second run fails and the
# fifth run is guesswork.
#
# The ledger is a `schema_migrations` table with one row per
# applied file. Files are applied in lexicographic order, so
# name them 001_, 002_, … The runner is intentionally dumb:
# no down-migrations, no framework, and it refuses to run if
# a file changed after being applied (checksum mismatch),
# because that is how two environments silently diverge.
# =========================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="$(docker compose version >/dev/null 2>&1 && echo 'docker compose' || echo 'docker-compose')"

DB_NAME="${DB_NAME:-gamehub}"
DB_USER="${DB_USER:-gamehub}"
DB_PASSWORD="${DB_PASSWORD:-gamehub_local_pw}"
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-3306}"
MIGRATIONS_DIR="$ROOT/db/migrations"

STATUS_ONLY=0
[ "${1:-}" = "--status" ] && STATUS_ONLY=1

# Two ways to reach the database, because this runs in two places:
#   compose → `docker compose exec` into the db container
#             (local development and the EC2 host)
#   client  → the mysql client on PATH, talking to DB_HOST
#             (CI, where MySQL is a service container)
# MIGRATE_VIA picks one explicitly; the default decides by asking
# whether the Compose db service is actually up.
MIGRATE_VIA="${MIGRATE_VIA:-}"
if [ -z "$MIGRATE_VIA" ]; then
    if $COMPOSE ps db --status running 2>/dev/null | grep -q .; then
        MIGRATE_VIA="compose"
    else
        MIGRATE_VIA="client"
    fi
fi

# -T: no TTY (works from CI and from an SSM command).
# MYSQL_PWD: the password travels in the environment rather than on a
# command line that `ps` can read and that mysql warns about every run.
# --silent --skip-column-names: machine-readable output only.
mysql_cmd() {
    if [ "$MIGRATE_VIA" = "compose" ]; then
        $COMPOSE exec -T -e MYSQL_PWD="$DB_PASSWORD" db \
            mysql --silent --skip-column-names -u"$DB_USER" "$DB_NAME" "$@"
    else
        MYSQL_PWD="$DB_PASSWORD" mysql --silent --skip-column-names \
            -h "${DB_HOST:-127.0.0.1}" -P "$DB_PORT" \
            -u"$DB_USER" "$DB_NAME" "$@"
    fi
}

echo "==> migrations against ${DB_NAME} (via ${MIGRATE_VIA})"

mysql_cmd -e "
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(255) NOT NULL,
        checksum   CHAR(64)     NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"

# sha256 of the file body, so a rewritten migration is caught.
checksum() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    else
        shasum -a 256 "$1" | awk '{print $1}' # macOS
    fi
}

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
    echo "    no migration files found in db/migrations/"
    exit 0
fi

applied_count=0
pending_count=0

for file in "${files[@]}"; do
    version="$(basename "$file")"
    sum="$(checksum "$file")"

    recorded="$(mysql_cmd -e "SELECT checksum FROM schema_migrations WHERE version = '$version';")"

    if [ -n "$recorded" ]; then
        if [ "$recorded" != "$sum" ]; then
            echo "  ✘ ${version}: already applied with a different checksum."
            echo "    Edit history: add a NEW migration instead of rewriting this one."
            exit 1
        fi
        echo "  ✔ ${version} (already applied)"
        applied_count=$((applied_count + 1))
        continue
    fi

    pending_count=$((pending_count + 1))
    if [ "$STATUS_ONLY" = "1" ]; then
        echo "  … ${version} (pending)"
        continue
    fi

    echo "  → applying ${version}"
    mysql_cmd < "$file"
    mysql_cmd -e "
        INSERT INTO schema_migrations (version, checksum)
        VALUES ('$version', '$sum');"
done

if [ "$STATUS_ONLY" = "1" ]; then
    echo "    ${applied_count} applied, ${pending_count} pending"
else
    echo "✔ migrations up to date (${applied_count} already applied, ${pending_count} applied now)"
fi
