# Multi-stage production build for Daimoma (007:T003).
# Stage 1: Build hashed React SPA assets (no secrets in build args).
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Same-origin web gateway serving SPA assets and proxying /api/v1/ to backend.
FROM nginx:1.27-alpine AS web
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deployment/nginx-container.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html
EXPOSE 8080

# Stage 3: Locked non-root Django + Gunicorn production runtime.
FROM python:3.12-slim-bookworm AS backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production

RUN groupadd --gid 10001 daimoma \
    && useradd --uid 10001 --gid daimoma --shell /usr/sbin/nologin --create-home daimoma

WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY --chown=daimoma:daimoma backend/ ./
RUN mkdir -p /app/staticfiles /app/media \
    && DJANGO_SECRET_KEY="build-only-collectstatic-placeholder-key-not-used-at-runtime" \
       DJANGO_ALLOWED_HOSTS="localhost" \
       DATABASE_URL="sqlite:///:memory:" \
       python manage.py collectstatic --noinput \
    && chown -R daimoma:daimoma /app/staticfiles /app/media

USER daimoma
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
