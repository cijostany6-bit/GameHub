#!/usr/bin/env bash
# =========================================================
# Argo CD on the kind cluster — GitOps for GameHub.
#
#   ./scripts/argocd-up.sh      # or: make argocd-up
#
# Installs Argo CD, applies k8s/argocd/application.yaml and
# waits until the Application reports Synced + Healthy.
#
# The point to notice: there is no `kubectl apply` for the app
# after this. Argo CD pulls k8s/ from Git and reconciles it
# continuously, so a `kubectl edit` is reverted and a merge to
# main is a deployment.
# =========================================================
set -euo pipefail

CLUSTER="${CLUSTER:-gamehub}"
ARGO_VERSION="${ARGO_VERSION:-stable}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v kubectl >/dev/null 2>&1; then
    echo "✘ missing: kubectl" >&2
    exit 1
fi

if ! kubectl config get-contexts -o name | grep -q "kind-${CLUSTER}"; then
    echo "✘ no kind-${CLUSTER} context — run ./scripts/kind-up.sh first" >&2
    exit 1
fi
kubectl config use-context "kind-${CLUSTER}" >/dev/null

if kubectl get deployment argocd-server -n argocd >/dev/null 2>&1; then
    echo "==> Argo CD already installed"
else
    echo "==> installing Argo CD (${ARGO_VERSION})"
    kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    # --server-side: the applicationsets CRD's annotations exceed the 256 KiB
    # limit of client-side apply's last-applied-configuration annotation.
    kubectl apply --server-side -n argocd \
        -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGO_VERSION}/manifests/install.yaml" >/dev/null
fi

echo "==> waiting for Argo CD to become available"
kubectl -n argocd rollout status deployment/argocd-server --timeout=300s
kubectl -n argocd rollout status statefulset/argocd-application-controller --timeout=300s

echo "==> handing the app manifests to Argo CD"
kubectl apply -f k8s/argocd/application.yaml

echo "==> waiting for the first sync (Argo CD is pulling the repo and reconciling)"
for _ in $(seq 1 60); do
    # `read` from an empty process substitution returns non-zero, and with
    # `set -e` that ended this script silently on the first poll (the
    # Application has no status yet). Collect first, parse defensively.
    out="$(kubectl -n argocd get application gamehub \
        -o jsonpath='{.status.sync.status} {.status.health.status}' 2>/dev/null || true)"
    sync="$(printf '%s' "$out" | awk '{print $1}')"
    health="$(printf '%s' "$out" | awk '{print $2}')"
    [ -n "$sync" ] || sync="Unknown"
    [ -n "$health" ] || health="Unknown"

    printf '   sync=%-10s health=%s\n' "$sync" "$health"
    if [ "$sync" = "Synced" ] && [ "$health" = "Healthy" ]; then
        break
    fi
    sleep 5
done

echo
kubectl -n argocd get application gamehub -o custom-columns=\
'NAME:.metadata.name,SYNC:.status.sync.status,HEALTH:.status.health.status,REVISION:.status.sync.revision'

echo
echo "✔ Argo CD is managing GameHub from Git"
echo "  UI:       kubectl -n argocd port-forward svc/argocd-server 8443:443  →  https://localhost:8443"
echo "  user:     admin"
printf '  password: '
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
echo
echo "  prove selfHeal:  kubectl -n gamehub scale deploy/gamehub-frontend --replicas=1"
echo "                   (Argo CD puts it back to 2 within a minute)"
