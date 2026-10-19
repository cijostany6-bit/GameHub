# syntax=docker/dockerfile:1
# =========================================================
# GameHub frontend — static UI served by nginx (pinned).
# The build context is the repo root; .dockerignore keeps
# .git, node_modules and secrets out of the context.
# =========================================================
FROM nginx:1.29-alpine

COPY frontend/ /usr/share/nginx/html/
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/nginx-log-format.conf /etc/nginx/conf.d/00-log-format.conf

EXPOSE 80
