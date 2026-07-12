# syntax=docker/dockerfile:1
# --------- Imagen de la API (NestJS) ---------
FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

# --- Dependencias (cacheables por los manifests) ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile=false

# --- Build ---
FROM deps AS build
COPY . .
RUN pnpm --filter @nab/database generate
RUN pnpm --filter @nab/shared build
RUN pnpm --filter @nab/database build
RUN pnpm --filter @nab/api build

# --- Runner ---
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S nab && adduser -S nab -G nab
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
USER nab
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
