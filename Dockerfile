# Multi-stage build for a Vite SPA served by Nginx

# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies with cache-friendly layering
COPY package*.json ./
# Use npm ci when lockfile exists for reproducible installs; fallback to npm i otherwise
RUN if [ -f package-lock.json ]; then npm ci; else npm i; fi

# Copy the rest of the source and build
COPY . .
RUN npm run build

# ---- Runtime (Nginx) ----
FROM nginx:alpine AS runtime

# Copy custom nginx config (SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Basic liveness check (busybox wget is available in Alpine)
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
