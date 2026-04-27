# syntax=docker/dockerfile:1.7
# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps with deterministic lockfile
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build-time env for Vite. Docker only picks these up if passed via --build-arg
# or the `build.args` block in docker-compose. All VITE_* vars are embedded
# into the bundle — set them per environment at build time, not runtime.
ARG VITE_API_BASE_URL
ARG VITE_SOCKET_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SENTRY_DSN

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN

RUN npm run build

# ─── Stage 2: runner ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Drop the default config and ship our SPA-aware one
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/alshifa.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Nginx image ships with a non-root `nginx` user by default and a healthy
# default CMD — don't override it.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1
