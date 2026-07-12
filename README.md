# Nab

**Plataforma de automatización de búsqueda de empleo con IA.** Agrega ofertas, genera CVs y cartas de presentación personalizados para cada vacante, permite aplicar con un toque (swipe) y ofrece un dashboard de seguimiento. Monetización por suscripción de créditos.

> Proyecto inspirado en el concepto de Sprout, con identidad, código y diseño propios.

## Arquitectura

Monorepo **Turborepo + pnpm** con tres servicios desplegables (web, api, workers) y paquetes compartidos.

```
apps/
  web/       Next.js 15 (landing + dashboard)
  api/       NestJS (REST + WebSockets)
  workers/   NestJS standalone (colas BullMQ: ingesta, IA, emails)
  mobile/    Expo/React Native (Expo Router, feed swipe, coach, push)
packages/
  ui/        Design system (tokens, componentes)
  database/  Prisma schema + cliente + seeds
  shared/    Zod schemas, tipos y constantes compartidas
  config/    tsconfig / eslint / tailwind compartidos
```

**Stack**: TypeScript · Next.js · NestJS · Prisma · PostgreSQL 16 + pgvector · Redis + BullMQ · Claude API · Stripe · Tailwind + shadcn/ui + Framer Motion.

## Requisitos

- Node.js ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)
- Docker + Docker Compose

## Puesta en marcha (desarrollo)

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar infraestructura local (Postgres, Redis, MinIO, Mailpit)
pnpm docker:dev

# 4. Generar cliente Prisma, migrar y sembrar datos demo
pnpm db:generate && pnpm db:migrate && pnpm db:seed

# 5. Arrancar todas las apps en modo desarrollo
pnpm dev
```

- Web: http://localhost:3000
- API + Swagger: http://localhost:4000/docs
- Mailpit (correos de dev): http://localhost:8025
- MinIO (consola): http://localhost:9001

## Ejecutar la aplicación completa con Docker (consumo)

Levanta web + api + workers + Postgres + Redis con un solo comando:

```bash
pnpm docker:up   # docker compose up --build
```

## App móvil (Expo)

```bash
cd apps/mobile
cp .env.example .env       # ajusta EXPO_PUBLIC_API_URL a la IP de tu red si usas un dispositivo físico
pnpm start                 # abre Expo Dev Tools; escanea el QR con Expo Go
```

- `pnpm --filter @nab/mobile typecheck` / `lint` / `export` (build estático de verificación).
- Build de distribución (requiere cuenta de Expo/EAS): `npx eas-cli build --platform ios|android --profile preview`.

## Comandos útiles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Arranca todas las apps en watch mode |
| `pnpm build` | Build de todo el monorepo |
| `pnpm lint` | Linter en todos los paquetes |
| `pnpm typecheck` | Verificación de tipos |
| `pnpm test` | Tests |
| `pnpm db:migrate` | Aplica migraciones Prisma |
| `pnpm db:seed` | Siembra datos demo |

## Fases de desarrollo

El desarrollo siguió un plan por fases (ver `/Users/juanpablo/.claude/plans/`):

0. ✅ Fundaciones — monorepo, infra, Docker
1. ✅ Auth, usuarios y perfil (onboarding con parsing de CV)
2. ✅ Ingesta de vacantes y catálogo
3. ✅ Motor de IA: personalización de CV/carta y matching
4. ✅ Aplicaciones, feed swipe y dashboard kanban
5. ✅ Chatbot (soporte + career coach)
6. ✅ Monetización (Stripe), landing final y pulido
7. ✅ App móvil (Expo) — Expo Router, feed swipe nativo, tracking, coach,
   push notifications (Expo Notifications) y sincronización en tiempo real
   (WebSocket) compartida con la web
