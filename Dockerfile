# syntax=docker/dockerfile:1
#
# Dokploy: set Build Type to Dockerfile, context ".", optional dockerBuildStage: production.
# Vite bakes env at build time — add these as build arguments (and matching env) in Dokploy:
#   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Build-time variables for Vite (import.meta.env.VITE_*). The publishable key is public in the browser by design.
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_PUBLISHABLE_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

RUN npm run build

# ---

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
