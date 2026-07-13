# syntax=docker/dockerfile:1
# --------- Imagen de la Web (Next.js standalone) ---------
FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @nab/shared build
RUN pnpm --filter @nab/web build

# El output standalone incluye solo lo necesario para correr Next.
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Sin esto, el server standalone de Next resuelve el hostname del contenedor
# y se bindea a esa IP específica en vez de todas las interfaces: el
# healthcheck (y cualquier proxy) recibiría "connection refused".
ENV HOSTNAME="0.0.0.0"
RUN addgroup -S nab && adduser -S nab -G nab
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
USER nab
EXPOSE 3000
# 127.0.0.1 explícito: ver nota en docker/api.Dockerfile sobre IPv6/localhost.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
