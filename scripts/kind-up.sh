#!/usr/bin/env bash
# =========================================================
# GameHub on a local Kubernetes cluster (kind).
#
#   ./scripts/kind-up.sh        # or: make kind-up
#
# Creates a kind cluster, builds the SAME images the Compose
# stack uses, side-loads them into the cluster, applies the
# manifests under k8s/ and runs the same smoke test.
#
# Why kind: a real API server, scheduler, controllers and
# kubelet — the thing you would otherwise learn on a managed
# cluster that bills by the hour. Everything here is deleted
# by `make kind-down`.
# =========================================================
set -euo pipefail

CLUSTER="${CLUSTER:-gamehub}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="$(docker compose version >/dev/null 2>&1 && echo 'docker compose' || echo 'docker-compose')"

need() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "✘ missing: $1 — $2" >&2
        exit 1
    fi
}
need docker "install Colima (brew install colima && colima start --cpu 4 --memory 6)"
need kind "brew install kind"
need kubectl "brew install kubectl"

# --- 1. cluster ------------------------------------------------------
if kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
    echo "==> reusing kind cluster '$CLUSTER'"
else
    echo "==> creating kind cluster '$CLUSTER'"
    kind create cluster --config k8s/kind-config.yaml --name "$CLUSTER"
fi

# --- 2. images -------------------------------------------------------
# Same Dockerfiles, same tags as docker-compose.yml. The cluster has no
# registry access to anything private, so the images are loaded directly
# (which is why the Deployments say imagePullPolicy: Never).
echo "==> building images"
$COMPOSE build

echo "==> loading images into the cluster"
kind load docker-image gamehub-frontend:local gamehub-backend:local --name "$CLUSTER"

# --- 3. manifests ----------------------------------------------------
echo "==> rendering the database seed ConfigMap from db/init.sql"
"$ROOT/scripts/build-k8s-dbinit.sh" >/dev/null

echo "==> applying manifests"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/config.yaml
kubectl apply -f k8s/db-init-configmap.yaml
kubectl apply -f k8s/db.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml

# --- 4. wait for it --------------------------------------------------
echo "==> waiting for rollouts"
kubectl -n gamehub rollout status statefulset/gamehub-db --timeout=300s
kubectl -n gamehub rollout status deployment/gamehub-backend --timeout=300s
kubectl -n gamehub rollout status deployment/gamehub-frontend --timeout=180s

kubectl -n gamehub get pods -o wide

# --- 5. prove it works ----------------------------------------------
# Kind publishes the node's 30080 on host port 8081, so the cluster and
# the Compose stack (on 8080) can run at the same time. Same smoke test.
echo "==> smoke test through the NodePort (kind publishes 30080 → host :8081)"
BASE_URL=http://localhost:8081 "$ROOT/scripts/smoke.sh"

echo
echo "✔ GameHub is running on Kubernetes → http://localhost:8081"
echo "  logs:     kubectl -n gamehub logs deploy/gamehub-backend -f"
echo "  scale:    kubectl -n gamehub scale deploy/gamehub-backend --replicas=4"
echo "  GitOps:   ./scripts/argocd-up.sh"
