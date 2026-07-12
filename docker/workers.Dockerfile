# syntax=docker/dockerfile:1
# --------- Imagen de los Workers (BullMQ) ---------
FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/workers/package.json ./apps/workers/
RUN pnpm install --frozen-lockfile=false

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
USER nab
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD pgrep -f "apps/workers/dist/main.js" > /dev/null || exit 1
CMD ["node", "apps/workers/dist/main.js"]
