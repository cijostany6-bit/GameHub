#!/usr/bin/env bash
# =========================================================
# Render k8s/db-init-configmap.yaml from db/init.sql.
#
# MySQL executes every *.sql file in /docker-entrypoint-initdb.d
# on the first start of an empty data directory. In Compose the
# host file is mounted straight in; in Kubernetes the SQL has to
# travel as a ConfigMap, which means a copy of the file lives in
# Git. This script is what keeps the copy honest:
#
#   scripts/build-k8s-dbinit.sh           # write the manifest
#   scripts/build-k8s-dbinit.sh --check   # fail if it has drifted
#
# CI runs the --check form, so a change to db/init.sql that is
# not reflected in the ConfigMap fails the build instead of
# silently seeding a different schema in the cluster.
# =========================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/k8s/db-init-configmap.yaml"

render() {
    cat <<'HEADER'
# =========================================================
# GENERATED FILE — do not edit by hand.
#
#   source: db/init.sql
#   render: scripts/build-k8s-dbinit.sh
#
# The rendered copy is checked into Git because Argo CD syncs
# manifests from the repository, and it is verified against the
# source in CI (scripts/build-k8s-dbinit.sh --check).
# =========================================================
apiVersion: v1
kind: ConfigMap
metadata:
  name: gamehub-db-init
  namespace: gamehub
  labels:
    app.kubernetes.io/part-of: gamehub
data:
  init.sql: |
HEADER
    # Indent by four spaces; leave blank lines blank so the block
    # scalar stays readable and diffable.
    awk '{ if (length($0) == 0) print ""; else print "    " $0 }' "$ROOT/db/init.sql"
}

if [ "${1:-}" = "--check" ]; then
    if diff <(render) "$OUT" >/dev/null 2>&1; then
        echo "✔ k8s/db-init-configmap.yaml matches db/init.sql"
    else
        echo "✘ k8s/db-init-configmap.yaml has drifted from db/init.sql:"
        diff <(render) "$OUT" | head -30
        echo "  fix: ./scripts/build-k8s-dbinit.sh"
        exit 1
    fi
else
    render > "$OUT"
    echo "✔ wrote k8s/db-init-configmap.yaml ($(wc -l < "$OUT" | tr -d ' ') lines)"
fi
