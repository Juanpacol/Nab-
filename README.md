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
8. ✅ Portal B2B para empresas — generación de pruebas técnicas con IA
   (rúbrica citada y verificada), publicación de vacantes propias,
   evaluación de candidatos con IA + override humano, dashboard con
   métricas y comparativa, chat candidato↔RH en tiempo real (web y móvil).
   Ver la sección [Portal de empresas (B2B)](#portal-de-empresas-b2b) más abajo.
9. 🚧 Despliegue a beta pública (web en Vercel + api/workers/Postgres/Redis
   en VPS) — ver [docs/DEPLOY.md](docs/DEPLOY.md) para el runbook completo.

## Portal de empresas (B2B)

Nab es un marketplace de dos lados: candidatos (feed swipe, CVs/cartas con IA)
y empresas, que pueden usar Nab como su propio ATS ligero con evaluación
técnica asistida por IA.

**Flujo de una empresa**: crear cuenta de empresa (`/empresa/onboarding`) →
publicar una vacante propia → generar una prueba técnica con IA a partir de
un título + especificación del rol (`/empresa/vacantes/:id/prueba/crear`) →
los candidatos aplican y la resuelven desde el feed normal (web o móvil) →
evaluar cada submission con IA (o revisar/ajustar el puntaje a mano) →
comparar candidatos lado a lado → chatear directo con cada candidato.

**Piezas clave**:
- **Rúbrica citada y verificada**: cada criterio de evaluación cita su fuente
  (un fragmento textual de la especificación del rol, un estándar técnico de
  un catálogo curado, o una guía interna) — la verificación la hace el
  pipeline en código, nunca el modelo. Ver `packages/shared/src/tech-tests.ts`
  y `apps/api/src/modules/tech-tests/tech-test-generation.service.ts`.
- **Multi-tenant**: `Company` + `CompanyMember` (roles OWNER/RECRUITER),
  aislamiento estricto por `companyId` derivado siempre de la membresía
  verificada del JWT, nunca del cliente. Ver `apps/api/src/modules/companies/`.
- **Créditos**: generar una prueba, evaluar un candidato y generar un
  análisis comparativo con IA cuestan créditos del mismo `CreditLedger` que
  usa el resto de la plataforma (`CREDIT_COSTS.TEST_GENERATION/EVALUATION/COMPARISON`
  en `packages/shared/src/plans.ts`).
- **Chat en tiempo real**: `ApplicationThread`/`ThreadMessage` por aplicación,
  vía el mismo `RealtimeGateway` (WebSocket) que el resto de la plataforma,
  con push notifications (Expo) al candidato si está offline.

`pnpm db:seed` crea una empresa demo (`rh-demo@nab.app`) con una vacante,
una prueba técnica lista y dos candidatos ya evaluados (uno aprobado, uno no)
para explorar el dashboard/candidatos/comparativa sin tener que generar nada
manualmente.
