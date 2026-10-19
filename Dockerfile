# syntax=docker/dockerfile:1
# =========================================================
# GameHub frontend — static UI served by nginx (pinned).
# The build context is the repo root; .dockerignore keeps
# .git, node_modules and secrets out of the context.
# =========================================================
FROM nginx:stable-alpine

# Apply the Alpine security updates that exist on top of this base tag.
# The tag is pinned to the stable channel (so the base is current) and
# Dependabot tracks it; this line closes the gap between the tag's last
# rebuild and today, which is where a scan had found 2 HIGH CVEs in
# libexpat and libx11 — both fixed in the Alpine repo already.
RUN apk upgrade --no-cache

COPY frontend/ /usr/share/nginx/html/
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/nginx-log-format.conf /etc/nginx/conf.d/00-log-format.conf

EXPOSE 80
