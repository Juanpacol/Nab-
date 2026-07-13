# syntax=docker/dockerfile:1
# --------- Imagen de los Workers (BullMQ) ---------
FROM node:20-alpine AS base
# openssl es requisito de los engines de Prisma en Alpine (sin él, detecta mal
# la versión de OpenSSL y falla al arrancar).
RUN corepack enable && apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/workers/package.json ./apps/workers/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @nab/database generate
RUN pnpm --filter @nab/shared build
RUN pnpm --filter @nab/database build
RUN pnpm --filter @nab/workers build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S nab && adduser -S nab -G nab
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/workers/dist ./apps/workers/dist
COPY --from=build /app/apps/workers/package.json ./apps/workers/
# pnpm enlaza las dependencias DIRECTAS de @nab/workers como symlinks dentro
# de apps/workers/node_modules → ../../node_modules/.pnpm/...; sin copiar
# también esta carpeta, "node apps/workers/dist/main.js" no las encuentra.
COPY --from=build /app/apps/workers/node_modules ./apps/workers/node_modules
USER nab
EXPOSE 4100
# 127.0.0.1 explícito: ver nota en docker/api.Dockerfile sobre IPv6/localhost.
# El puerto es solo del health server interno (ver src/health-server.ts) —
# los workers no sirven tráfico de negocio por HTTP.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:${PORT:-4100}/ || exit 1
CMD ["node", "apps/workers/dist/main.js"]
