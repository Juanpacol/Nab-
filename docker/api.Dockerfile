# syntax=docker/dockerfile:1
# --------- Imagen de la API (NestJS) ---------
FROM node:20-alpine AS base
# openssl es requisito de los engines de Prisma en Alpine (sin él, detecta mal
# la versión de OpenSSL y falla al arrancar o al migrar).
RUN corepack enable && apk add --no-cache libc6-compat openssl
WORKDIR /app

# --- Dependencias (cacheables por los manifests) ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

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
# El servicio "migrate" del compose corre `pnpm --filter @nab/database migrate`
# contra esta imagen: sin el package.json raíz (con el pin "packageManager"),
# corepack intenta descargar el pnpm más reciente, que exige Node ≥22 y
# revienta en node:20-alpine. Copiar estos tres archivos fija la versión.
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
# pnpm enlaza las dependencias DIRECTAS de @nab/api (@nestjs/*, argon2, etc.)
# como symlinks dentro de apps/api/node_modules → ../../node_modules/.pnpm/...;
# sin copiar también esta carpeta, "node apps/api/dist/main.js" no las encuentra.
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
USER nab
EXPOSE 4000
# 127.0.0.1 explícito: "localhost" resuelve a ::1 (IPv6) en Alpine y Nest solo
# escucha en 0.0.0.0 (IPv4), lo que haría fallar el healthcheck con connection
# refused aunque el servidor esté sano.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
